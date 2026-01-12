function detectVendor(partNum, link) {
  if (!vendorConfigs?.length) return null;
  const normalizedLink = (link || "").toLowerCase();
  const candidates = vendorConfigs.filter((v) => {
    if (!isVendorFetchable(v)) return false;
    let regex = null;
    if (v.partNumberPattern) {
      try {
        regex = new RegExp(v.partNumberPattern, "i");
      } catch (e) {
        regex = null;
      }
    }
    const baseMatch =
      v.baseUrl &&
      normalizedLink &&
      normalizedLink.includes(v.baseUrl.toLowerCase());
    const patternMatch = regex && partNum && regex.test(partNum);
    const domainMatch =
      Array.isArray(v.detectionHints?.domains) && normalizedLink
        ? v.detectionHints.domains.some((domain) =>
            normalizedLink.includes(domain.toLowerCase()),
          )
        : false;
    return baseMatch || patternMatch || domainMatch;
  });
  if (candidates.length === 1) return candidates[0];
  return null;
}

function isVendorFetchable(config) {
  if (!config) return false;
  if ((config.source || "").toLowerCase() === "builtin") {
    return Boolean(config.capabilities?.productLookup);
  }
  return true;
}

function renderVendorOptions() {
  const supported = vendorConfigs
    .filter((v) => isVendorFetchable(v))
    .map((v) => v.vendor)
    .filter(Boolean);
  const msg = supported.length
    ? `Supported vendors: ${supported.join(", ")}, Shopify-Based Sites`
    : "Supported vendors: none configured yet; use manual entry";
  const fetchSupportedEl = document.getElementById("fetch-supported");
  const fetchSupportedCatalogEl = document.getElementById(
    "fetch-supported-catalog",
  );
  if (fetchSupportedEl) fetchSupportedEl.textContent = msg;
  if (fetchSupportedCatalogEl) fetchSupportedCatalogEl.textContent = msg;
}

function vendorOptionValue(v) {
  return (v?.key || v?.slug || v?.vendor || v?._id || "")
    .toString()
    .toLowerCase();
}

function updateManualVendorHint() {
  if (!manualVendorHint) return;
  if (manualVendorOverride) {
    const label =
      manualVendorOverride.vendor ||
      manualVendorOverride.slug ||
      manualVendorOverride.key ||
      "Vendor";
    manualVendorHint.textContent = `Using ${label} for vendor-specific fetching.`;
  } else {
    manualVendorHint.textContent =
      "Select a configured vendor to force API fetching, or leave as Other to auto-detect.";
  }
}

function resetManualVendorOverride() {
  manualVendorOverride = null;
  if (manualVendorSelect) manualVendorSelect.value = "";
  updateManualVendorHint();
}

function renderManualVendorOptions() {
  const options = vendorConfigs
    .filter((v) => isVendorFetchable(v))
    .slice()
    .sort((a, b) => (a.vendor || "").localeCompare(b.vendor || ""));
  const optionHtml = ['<option value="">Other / manual entry</option>']
    .concat(
      options.map(
        (v) =>
          `<option value="${vendorOptionValue(v)}">${escapeHtml(
            v.vendor || v.slug || v.key || "Vendor",
          )}</option>`,
      ),
    )
    .join("");
  if (manualVendorSelect) {
    const previous = manualVendorSelect.value;
    manualVendorSelect.innerHTML = optionHtml;
    const match = vendorConfigs.find(
      (v) => vendorOptionValue(v) === previous,
    );
    manualVendorSelect.value = match ? previous : "";
    manualVendorOverride = match || null;
    updateManualVendorHint();
  }
  if (catalogVendorSelect) {
    const previous = catalogVendorSelect.value;
    catalogVendorSelect.innerHTML = optionHtml;
    const match = vendorConfigs.find(
      (v) => vendorOptionValue(v) === previous,
    );
    catalogVendorSelect.value = match ? previous : "";
  }
}

function renderVendorImportOptions() {
  if (!vendorImportSelect) return;
  if (!canUseVendorImport()) {
    vendorImportSelect.innerHTML = '<option value="">Select vendor</option>';
    vendorImportSelect.disabled = true;
    vendorImportVendor = null;
    updateVendorImportInstructions();
    renderVendorImportPreview();
    return;
  }
  const options = vendorConfigs.filter(
    (v) => v?.capabilities?.quickOrderImport,
  );
  const previous = vendorImportSelect.value;
  vendorImportSelect.innerHTML = ['<option value="">Select vendor</option>']
    .concat(
      options.map(
        (v) =>
          `<option value="${vendorOptionValue(v)}">${escapeHtml(v.vendor || v.slug || v.key || "Vendor")}</option>`,
      ),
    )
    .join("");
  if (!options.length) {
    vendorImportSelect.disabled = true;
    if (vendorImportInstructions) {
      vendorImportInstructions.textContent =
        "No vendors have quick import configured yet.";
    }
  } else {
    vendorImportSelect.disabled = false;
    const match = options.find((v) => vendorOptionValue(v) === previous);
    vendorImportSelect.value = match ? previous : "";
    vendorImportVendor = match || null;
    updateVendorImportInstructions();
  }
  renderVendorImportPreview();
}

function canUseVendorImport() {
  return Boolean(currentUser?.permissions?.canImportBulkOrders);
}

function requiresOrderNotes() {
  return !currentUser?.permissions?.notesNotRequired;
}

function syncOrderNotesRequirement() {
  const required = requiresOrderNotes();
  const notesInput = orderForm?.elements?.notes;
  if (notesInput) notesInput.required = required;
  if (orderNotesLabel)
    orderNotesLabel.textContent = required ? "Notes (required)" : "Notes";
}

function syncVendorImportVisibility() {
  const allowed = canUseVendorImport();
  if (orderSourceImport)
    orderSourceImport.style.display = allowed ? "inline-flex" : "none";
  if (!allowed) {
    if (orderImportFields) orderImportFields.style.display = "none";
    if (orderSource === "import") setOrderSource("manual");
    vendorImportVendor = null;
    if (vendorImportSelect) {
      vendorImportSelect.value = "";
      vendorImportSelect.disabled = true;
    }
    if (vendorImportInstructions) {
      vendorImportInstructions.textContent =
        "Bulk vendor import is disabled for this account.";
    }
    if (vendorImportActions) vendorImportActions.style.display = "none";
  } else {
    if (vendorImportSelect) vendorImportSelect.disabled = false;
    updateVendorImportInstructions();
  }
}

function updateVendorImportInstructions() {
  if (!vendorImportInstructions) return;
  if (!canUseVendorImport()) {
    vendorImportInstructions.textContent =
      "Bulk vendor import is disabled for this account.";
    return;
  }
  if (!vendorImportVendor) {
    vendorImportInstructions.textContent =
      "Upload a supported vendor CSV or paste part numbers and quantities.";
    return;
  }
  if (isDigikeyVendor(vendorImportVendor)) {
    vendorImportInstructions.textContent =
      'For Digi-Key, download the cart CSV or paste lines like "2,WM10548-ND".';
  } else if (isMouserVendor(vendorImportVendor)) {
    vendorImportInstructions.textContent =
      'For Mouser, upload the cart XLS/CSV export or paste lines like "2,595-12345".';
  } else if (isShareACartVendor(vendorImportVendor)) {
    vendorImportInstructions.textContent =
      "Paste a Share-A-Cart link or cart ID (Amazon carts work best).";
  } else {
    vendorImportInstructions.textContent = `Import items from ${vendorImportVendor.vendor || "this vendor"} using a CSV or part number list.`;
  }
}

function setOrderSource(source) {
  const importAllowed = canUseVendorImport();
  if (source === "import" && !importAllowed) {
    if (currentUser) {
      showBoardMessage(
        "Bulk vendor import is disabled for this account.",
        "error",
        2500,
      );
    }
    source = "manual";
  }
  orderSource =
    source === "catalog"
      ? "catalog"
      : source === "import"
        ? "import"
        : "manual";
  const showImport = orderSource === "import" && importAllowed;
  if (orderSourceManual)
    orderSourceManual.classList.toggle("primary", orderSource === "manual");
  if (orderSourceCatalog)
    orderSourceCatalog.classList.toggle("primary", orderSource === "catalog");
  if (orderSourceImport)
    orderSourceImport.classList.toggle("primary", showImport);
  const showManualFields = orderSource === "manual";
  orderManualFields?.forEach((el) => {
    if (el) el.style.display = showManualFields ? "" : "none";
  });
  orderCatalogFields?.forEach((el) => {
    if (el) el.style.display = orderSource === "catalog" ? "" : "none";
  });
  if (orderImportFields)
    orderImportFields.style.display = showImport ? "block" : "none";
  if (orderStandardFields)
    orderStandardFields.style.display = showImport ? "none" : "contents";
  if (orderSubmitBar)
    orderSubmitBar.style.display = showImport ? "none" : "flex";
  if (vendorImportActions)
    vendorImportActions.style.display =
      showImport && vendorImportEntries.length ? "flex" : "none";
  if (orderForm) orderForm.noValidate = showImport;
  if (orderSource === "manual") {
    resetCatalogLookup();
    scheduleCatalogPresenceCheck();
    updateManualVendorHint();
  } else if (orderSource === "catalog") {
    if (catalogLookupInput) catalogLookupInput.focus();
  } else if (showImport) {
    if (vendorImportSelect && !vendorImportSelect.value) {
      vendorImportSelect.focus();
    }
  }
  if (typeof syncCatalogSaveUI === "function") {
    syncCatalogSaveUI();
  }
}

orderSourceManual?.addEventListener("click", () => setOrderSource("manual"));
orderSourceCatalog?.addEventListener("click", () => setOrderSource("catalog"));
orderSourceImport?.addEventListener("click", () => {
  if (!canUseVendorImport()) {
    showBoardMessage(
      "Bulk vendor import is disabled for this account.",
      "error",
      2500,
    );
    return;
  }
  setOrderSource("import");
});

function findVendorConfig(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return (
    vendorConfigs.find((v) => {
      return (
        (v.vendor || "").toLowerCase() === lower ||
        (v.slug || "").toLowerCase() === lower ||
        (v.key || "").toLowerCase() === lower
      );
    }) || null
  );
}

function deriveUrl(config, partNum, link) {
  if (link) return link;
  if (!config) return null;
  if (config.productUrlTemplate && partNum) {
    return config.productUrlTemplate.replace("{partNumber}", partNum);
  }
  if (config.baseUrl && partNum) {
    return `${config.baseUrl.replace(/\/$/, "")}/${partNum}`;
  }
  return null;
}

function extractPartNumberFromUrl(config, link) {
  if (!config || !link) return null;
  const vendorKey = (config.key || config.slug || "").toLowerCase();
  const vendorName = (config.vendor || "").toLowerCase();
  const isDigikey =
    vendorKey === "digikey" ||
    vendorName.includes("digi-key") ||
    vendorName.includes("digikey");
  const isMouser = vendorKey === "mouser" || vendorName.includes("mouser");
  const normalized = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  if (isDigikey) {
    try {
      const urlObj = new URL(normalized);
      const segments = urlObj.pathname.split("/").filter(Boolean);
      const detailIdx = segments.findIndex((p) => p.toLowerCase() === "detail");
      if (detailIdx !== -1 && segments.length > detailIdx + 2) {
        const partSegment = segments[detailIdx + 2];
        if (partSegment) return decodeURIComponent(partSegment);
      }
    } catch (err) {
      // ignore parse issues; fall through to returning null
    }
    return null;
  }
  if (isMouser) {
    try {
      const urlObj = new URL(normalized);
      const segments = urlObj.pathname.split("/").filter(Boolean);
      const detailIdx = segments.findIndex(
        (p) => p.toLowerCase() === "productdetail",
      );
      if (detailIdx !== -1) {
        if (segments.length > detailIdx + 2) {
          const partSegment = segments[detailIdx + 2];
          if (partSegment) return decodeURIComponent(partSegment);
        } else if (segments.length > detailIdx + 1) {
          const partSegment = segments[detailIdx + 1];
          if (partSegment) return decodeURIComponent(partSegment);
        }
      }
      const partParam =
        urlObj.searchParams.get("partnumber") ||
        urlObj.searchParams.get("partnumberlist");
      if (partParam) return partParam;
    } catch (err) {
      // ignore parse issues
    }
    return null;
  }
  const cleanLink = normalized.replace(/\/+$/, "");
  if (
    config.productUrlTemplate &&
    config.productUrlTemplate.includes("{partNumber}")
  ) {
    // Escape the template and swap the placeholder with a capture group.
    const pattern = config.productUrlTemplate
      .replace(/\{partNumber\}/g, "__PART__")
      .replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
      .replace(/__PART__/g, "([^/?#]+)");
    const regex = new RegExp(
      "^" + pattern.replace(/\\\/+$/, "") + "\\/?$",
      "i",
    );
    const m = cleanLink.match(regex);
    if (m && m[1]) return decodeURIComponent(m[1]);
  }
  if (config.partNumberPattern) {
    const regex = new RegExp(config.partNumberPattern, "i");
    const m = cleanLink.match(regex);
    if (m && m[1]) return m[1];
  }
  const parts = cleanLink.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
}

async function resolveBuiltinVendorPart(config, link) {
  if (!config || config.source !== "builtin" || !link) return null;
  const vendorKey = config.key || config.slug || config.vendor;
  if (!vendorKey) return null;
  try {
    const res = await fetch("/api/vendors/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorKey, url: link }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to resolve vendor link");
    return data;
  } catch (err) {
    console.warn("Failed to resolve vendor link", err);
    return null;
  }
}

function parsePrice(text) {
  if (!text) return undefined;
  const num = parseFloat(text.replace(/[^0-9\\.]+/g, ""));
  return Number.isFinite(num) ? num : undefined;
}

function generateId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function copyTextToClipboard(text) {
  if (!text) return Promise.resolve();
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const temp = document.createElement("textarea");
      temp.value = text;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function ensureXlsxLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxLoaderPromise) {
    xlsxLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = () => {
        if (window.XLSX) resolve(window.XLSX);
        else {
          xlsxLoaderPromise = null;
          reject(new Error("Failed to load XLSX parser"));
        }
      };
      script.onerror = () => {
        xlsxLoaderPromise = null;
        reject(new Error("Failed to load XLSX parser"));
      };
      document.head.appendChild(script);
    });
  }
  return xlsxLoaderPromise;
}

async function readWorkbookFromFile(file) {
  const XLSX = await ensureXlsxLibrary();
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

function resetVendorImportState(clearVendor = false) {
  vendorImportEntries = [];
  if (clearVendor && vendorImportSelect) {
    vendorImportSelect.value = "";
    vendorImportVendor = null;
    updateVendorImportInstructions();
  }
  if (vendorImportFile) vendorImportFile.value = "";
  if (vendorImportText) vendorImportText.value = "";
  if (vendorImportMessage) {
    vendorImportMessage.textContent = "";
    vendorImportMessage.className = "small";
  }
  renderVendorImportPreview();
}

function renderVendorImportPreview() {
  if (!vendorImportPreview) return;
  if (!vendorImportEntries.length) {
    vendorImportPreview.innerHTML =
      '<div class="empty">No vendor items parsed yet.</div>';
  } else {
    vendorImportPreview.innerHTML = vendorImportEntries
      .map((entry) => {
        const vendorTags = [];
        if (entry.digiKeyPartNumber)
          vendorTags.push(`Digi-Key: ${escapeHtml(entry.digiKeyPartNumber)}`);
        if (entry.mouserPartNumber)
          vendorTags.push(`Mouser: ${escapeHtml(entry.mouserPartNumber)}`);
        if (entry.manufacturerPartNumber)
          vendorTags.push(`MPN: ${escapeHtml(entry.manufacturerPartNumber)}`);
        return `
      <div class="card" data-import-id="${entry.id}" style="margin-bottom:8px; padding:10px;">
        <div class="flex-between" style="gap:8px; flex-wrap:wrap; align-items:flex-start;">
          <div style="flex:1; min-width:160px;">
            <div style="font-weight:600;">${escapeHtml(entry.description || entry.manufacturerPartNumber || entry.digiKeyPartNumber || entry.mouserPartNumber || "Part")}</div>
            <div class="small">Qty: ${entry.quantity || 1}${vendorTags.length ? " · " + vendorTags.join(" · ") : ""}</div>
            ${entry.customerReference ? `<div class="small">Ref: ${escapeHtml(entry.customerReference)}</div>` : ""}
          </div>
          <button class="btn ghost" data-action="remove-import-entry" data-index="${entry.id}" style="padding:4px 8px; color:var(--danger);">Remove</button>
        </div>
      </div>
    `;
      })
      .join("");
  }
  if (vendorImportSummary) {
    const summaryVendor =
      vendorImportEntries[0]?.vendorName ||
      vendorImportVendor?.vendor ||
      "vendor";
    vendorImportSummary.textContent = vendorImportEntries.length
      ? `Ready to import ${vendorImportEntries.length} item(s) from ${summaryVendor}.`
      : "";
  }
  if (vendorImportActions) {
    vendorImportActions.style.display =
      orderSource === "import" &&
      canUseVendorImport() &&
      vendorImportEntries.length
        ? "flex"
        : "none";
  }
}

function isDigikeyVendorName(name = "") {
  const lower = (name || "").toLowerCase();
  return lower.includes("digikey") || lower.includes("digi-key");
}

function isDigikeyVendor(vendor) {
  if (!vendor) return false;
  if (typeof vendor === "string") return isDigikeyVendorName(vendor);
  const key = (vendor.key || vendor.slug || "").toLowerCase();
  if (key === "digikey") return true;
  return isDigikeyVendorName(vendor.vendor || vendor.supplier || "");
}

function isMouserVendorName(name = "") {
  const lower = (name || "").toLowerCase();
  return lower.includes("mouser");
}

function isMouserVendor(vendor) {
  if (!vendor) return false;
  if (typeof vendor === "string") return isMouserVendorName(vendor);
  const key = (vendor.key || vendor.slug || "").toLowerCase();
  if (key === "mouser") return true;
  return isMouserVendorName(vendor.vendor || vendor.supplier || "");
}

function isShareACartVendorName(name = "") {
  const lower = (name || "").toLowerCase();
  return (
    lower.includes("share-a-cart") ||
    lower.includes("share a cart") ||
    lower.includes("shareacart")
  );
}

function isShareACartVendor(vendor) {
  if (!vendor) return false;
  if (typeof vendor === "string") return isShareACartVendorName(vendor);
  const key = (vendor.key || vendor.slug || "").toLowerCase();
  if (key === "shareacart" || key === "share-a-cart") return true;
  return isShareACartVendorName(vendor.vendor || vendor.supplier || "");
}

function isShareACartLink(link) {
  if (!link) return false;
  const raw = String(link).trim();
  if (!raw) return false;
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(normalized);
    return (url.hostname || "").toLowerCase().includes("share-a-cart.com");
  } catch (err) {
    return raw.toLowerCase().includes("share-a-cart.com");
  }
}

function supportsVendorExport(order) {
  if (!order) return false;
  const vendorName = order.vendor || order.supplier || "";
  if (isDigikeyVendorName(vendorName) || isMouserVendorName(vendorName))
    return true;
  const config = findVendorConfig(vendorName);
  return Boolean(config?.capabilities?.quickOrderExport);
}

function supportsVendorExportByName(name) {
  if (!name) return false;
  if (isDigikeyVendorName(name) || isMouserVendorName(name)) return true;
  const config = findVendorConfig(name);
  return Boolean(config?.capabilities?.quickOrderExport);
}

function parseVendorCsv(vendor, text) {
  if (!text) return [];
  if (isDigikeyVendor(vendor)) return parseDigikeyCartCsv(text);
  if (isMouserVendor(vendor)) return parseMouserCartCsv(text);
  throw new Error(
    `CSV import is not implemented for ${vendor.vendor || "this vendor"}.`,
  );
}

function parseVendorQuickText(vendor, text) {
  if (!text) return [];
  if (isDigikeyVendor(vendor)) return parseDigikeyQuickText(text);
  if (isMouserVendor(vendor)) return parseMouserQuickText(text);
  throw new Error(
    `Quick entry import is not implemented for ${vendor.vendor || "this vendor"}.`,
  );
}

function parseCsvText(text) {
  if (!text) return [];
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  const pushValue = () => {
    row.push(current);
    current = "";
  };
  const pushRow = () => {
    if (row.length && row.some((cell) => (cell || "").length)) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      pushValue();
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushValue();
      pushRow();
    } else {
      current += char;
    }
  }
  pushValue();
  pushRow();
  if (
    rows.length &&
    rows[0].length &&
    rows[0][0] &&
    rows[0][0].charCodeAt(0) === 0xfeff
  ) {
    rows[0][0] = rows[0][0].substring(1);
  }
  return rows;
}

function parseDigikeyCartCsv(text) {
  const rows = parseCsvText(text);
  if (!rows.length) return [];
  const normalizeHeader = (cell = "") =>
    cell
      .replace(/\ufeff/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const headerRow = rows.shift().map(normalizeHeader);
  const headerMap = {};
  headerRow.forEach((name, idx) => {
    if (name) headerMap[name] = idx;
  });
  const quantityIdx = headerMap.quantity;
  const digiKeyPartIdx = headerMap.partnumber;
  const manufacturerIdx = headerMap.manufacturerpartnumber;
  const descriptionIdx = headerMap.description;
  const customerRefIdx = headerMap.customerreference;
  const unitPriceIdx = headerMap.unitprice;
  if (quantityIdx === undefined || digiKeyPartIdx === undefined) {
    throw new Error("Unrecognized Digi-Key cart CSV format.");
  }
  const entries = [];
  rows.forEach((row) => {
    const qtyRaw = row[quantityIdx];
    const quantity = Number((qtyRaw || "").replace(/[^0-9.]/g, "")) || 0;
    if (!quantity) return;
    const digiKeyPartNumber = (row[digiKeyPartIdx] || "").trim();
    if (!digiKeyPartNumber) return;
    const manufacturerPartNumber = (row[manufacturerIdx] || "").trim() || "";
    const description = (row[descriptionIdx] || "").trim();
    const customerReference = (row[customerRefIdx] || "").trim();
    const unitPrice =
      unitPriceIdx !== undefined
        ? parseFloat((row[unitPriceIdx] || "").replace(/[^0-9.]/g, ""))
        : undefined;
    entries.push({
      id: generateId("import"),
      vendorKey: "digikey",
      quantity,
      digiKeyPartNumber,
      manufacturerPartNumber: manufacturerPartNumber || digiKeyPartNumber,
      description,
      customerReference,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : undefined,
      productUrl: buildDigikeySearchUrl(digiKeyPartNumber),
      source: "csv",
    });
  });
  if (!entries.length) throw new Error("No items found in the CSV file.");
  return entries;
}

function parseDigikeyQuickText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tokens = line.split(/[\s,;\t]+/).filter(Boolean);
      if (!tokens.length) return null;
      const firstIsQty = /^[0-9]+$/.test(tokens[0]);
      const lastIsQty = /^[0-9]+$/.test(tokens[tokens.length - 1]);
      let quantity = 1;
      let partNumber = "";
      if (firstIsQty && tokens.length > 1) {
        quantity = Number(tokens[0]) || 1;
        partNumber = tokens.slice(1).join(" ");
      } else if (lastIsQty && tokens.length > 1) {
        quantity = Number(tokens[tokens.length - 1]) || 1;
        partNumber = tokens.slice(0, -1).join(" ");
      } else if (tokens.length >= 2) {
        partNumber = tokens[0];
        quantity = Number(tokens[1]) || 1;
      } else {
        partNumber = tokens[0];
      }
      partNumber = partNumber.trim();
      if (!partNumber) return null;
      return {
        id: generateId("import"),
        vendorKey: "digikey",
        quantity: quantity || 1,
        digiKeyPartNumber: partNumber,
        manufacturerPartNumber: "",
        description: "",
        customerReference: "",
        unitPrice: undefined,
        productUrl: buildDigikeySearchUrl(partNumber),
        source: "text",
      };
    })
    .filter(Boolean);
}

function parseVendorWorkbook(vendor, workbook) {
  if (!vendor || !workbook) return [];
  if (isMouserVendor(vendor)) return parseMouserWorkbook(workbook);
  throw new Error(
    `Excel import is not implemented for ${vendor.vendor || "this vendor"}.`,
  );
}

function parseMouserWorkbook(workbook) {
  if (!workbook?.SheetNames?.length || !window.XLSX) {
    throw new Error("Unable to read the spreadsheet file.");
  }
  const XLSX = window.XLSX;
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error("The spreadsheet does not contain any sheets.");
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (!rows.length) {
    throw new Error("The spreadsheet is empty.");
  }
  const { header, data } = splitMouserHeader(rows);
  if (!header) {
    throw new Error("Unable to locate the Mouser header row.");
  }
  const normalizedHeader = header.map((cell, idx) => {
    return (cell || `Column${idx}`)
      .toString()
      .replace(/\ufeff/g, "")
      .trim();
  });
  const entries = data
    .map((row) => {
      if (!row || !row.length) return null;
      const record = {};
      normalizedHeader.forEach((key, idx) => {
        record[key] = row[idx];
      });
      return buildMouserEntryFromRecord(record, "xls");
    })
    .filter(Boolean);
  if (!entries.length)
    throw new Error("No items found in the Mouser spreadsheet.");
  return entries;
}

function splitMouserHeader(rows) {
  const clone = [...rows];
  while (clone.length) {
    const candidate = (clone.shift() || []).map((cell) => cell ?? "");
    if (rowLooksLikeMouserHeader(candidate)) {
      return { header: candidate, data: clone };
    }
  }
  return { header: null, data: [] };
}

function rowLooksLikeMouserHeader(row) {
  if (!Array.isArray(row)) return false;
  const normalized = row.map((cell) => String(cell || "").toLowerCase());
  const joined = normalized.join(" ");
  return (
    (joined.includes("mouser") ||
      joined.includes("manufacturer") ||
      joined.includes("mfr")) &&
    joined.includes("qty")
  );
}

function normalizeRecordKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cleanRecordValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getRecordValue(record, candidates = []) {
  const normalizedTargets = candidates.map((c) => c.toLowerCase());
  for (const key of Object.keys(record || {})) {
    const slug = normalizeRecordKey(key);
    if (!slug) continue;
    if (normalizedTargets.some((target) => slug.includes(target))) {
      const val = record[key];
      if (
        val !== undefined &&
        val !== null &&
        String(val).toString().trim() !== ""
      ) {
        return val;
      }
    }
  }
  return undefined;
}

function buildMouserEntryFromRecord(record, source = "csv") {
  if (!record) return null;
  const qtyRaw = getRecordValue(record, ["orderqty", "qty", "quantity"]);
  const mouserPart = cleanRecordValue(
    getRecordValue(record, ["mouserpart", "mousernumber", "mouser"]),
  );
  const manufacturerPart = cleanRecordValue(
    getRecordValue(record, ["manufacturerpart", "mfrpart", "mfrnumber"]),
  );
  const description = cleanRecordValue(getRecordValue(record, ["description"]));
  const priceRaw = getRecordValue(record, ["priceusd", "price"]);
  const customerRef = cleanRecordValue(
    getRecordValue(record, [
      "customerreference",
      "customerref",
      "custref",
      "customer",
    ]),
  );
  const qtyNumber = Number(String(qtyRaw || "").replace(/[^0-9.]/g, ""));
  const quantity = Number.isFinite(qtyNumber)
    ? Math.max(1, Math.round(qtyNumber))
    : 0;
  if (!quantity || (!mouserPart && !manufacturerPart)) return null;
  return {
    id: generateId("import"),
    vendorKey: "mouser",
    quantity,
    mouserPartNumber: mouserPart || undefined,
    manufacturerPartNumber: manufacturerPart || mouserPart || undefined,
    description: description || manufacturerPart || mouserPart || "",
    customerReference: customerRef || "",
    unitPrice: priceRaw ? parsePriceNumber(priceRaw) : undefined,
    productUrl: buildMouserSearchUrl(mouserPart || manufacturerPart),
    source,
  };
}

function parseMouserCartCsv(text) {
  const rows = parseCsvText(text);
  if (!rows.length) return [];
  const working = [...rows];
  let header = null;
  while (working.length && !header) {
    const candidate = working.shift().map((cell) => cell ?? "");
    if (rowLooksLikeMouserHeader(candidate)) {
      header = candidate;
    }
  }
  if (!header)
    throw new Error("Unable to locate the header row in the Mouser CSV.");
  const headerMap = header
    .map((cell, idx) => cell || `Column${idx}`)
    .map((cell) => cell.replace(/\ufeff/g, "").trim());
  const entries = working
    .map((row) => {
      if (
        !row ||
        !row.length ||
        !row.some((cell) => (cell || "").toString().trim().length)
      )
        return null;
      const record = {};
      headerMap.forEach((key, idx) => {
        record[key] = row[idx];
      });
      return buildMouserEntryFromRecord(record, "csv");
    })
    .filter(Boolean);
  if (!entries.length) throw new Error("No items found in the CSV file.");
  return entries;
}

function parseMouserQuickText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tokens = line.split(/[\s,;\t]+/).filter(Boolean);
      if (!tokens.length) return null;
      const firstIsQty = /^[0-9]+$/.test(tokens[0]);
      const lastIsQty = /^[0-9]+$/.test(tokens[tokens.length - 1]);
      let quantity = 1;
      let partNumber = "";
      if (firstIsQty && tokens.length > 1) {
        quantity = Number(tokens[0]) || 1;
        partNumber = tokens.slice(1).join(" ");
      } else if (lastIsQty && tokens.length > 1) {
        quantity = Number(tokens[tokens.length - 1]) || 1;
        partNumber = tokens.slice(0, -1).join(" ");
      } else if (tokens.length >= 2) {
        partNumber = tokens[0];
        quantity = Number(tokens[1]) || 1;
      } else {
        partNumber = tokens[0];
      }
      partNumber = partNumber.trim();
      if (!partNumber) return null;
      return {
        id: generateId("import"),
        vendorKey: "mouser",
        quantity: quantity || 1,
        mouserPartNumber: partNumber,
        manufacturerPartNumber: "",
        description: "",
        customerReference: "",
        unitPrice: undefined,
        productUrl: buildMouserSearchUrl(partNumber),
        source: "text",
      };
    })
    .filter(Boolean);
}

function buildDigikeySearchUrl(partNumber) {
  if (!partNumber) return undefined;
  return `https://www.digikey.com/en/products/search?keywords=${encodeURIComponent(partNumber)}`;
}

function buildMouserSearchUrl(partNumber) {
  if (!partNumber) return undefined;
  return `https://www.mouser.com/ProductDetail/${encodeURIComponent(partNumber)}`;
}

function buildVendorProductSearchUrl(vendorKey, partNumber) {
  const key = (vendorKey || "").toLowerCase();
  if (key === "digikey") return buildDigikeySearchUrl(partNumber);
  if (key === "mouser") return buildMouserSearchUrl(partNumber);
  return undefined;
}

function isDigikeySearchUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = (parsed.hostname || "").toLowerCase();
    const path = (parsed.pathname || "").toLowerCase();
    if (!host.includes("digikey")) return false;
    return path.includes("/products/search") || path.startsWith("/short/");
  } catch (err) {
    const lower = String(url).toLowerCase();
    return (
      lower.includes("digikey.com/en/products/search") ||
      lower.includes("digikey.com/short/")
    );
  }
}

function isMouserSearchUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = (parsed.hostname || "").toLowerCase();
    if (!host.includes("mouser")) return false;
    const path = (parsed.pathname || "").toLowerCase();
    return path.includes("/productdetail");
  } catch (err) {
    const lower = String(url).toLowerCase();
    return lower.includes("mouser.com/productdetail");
  }
}

function shouldReplaceVendorImportUrl(currentUrl, vendorKey) {
  if (!currentUrl) return true;
  const key = (vendorKey || "").toLowerCase();
  if (key === "digikey") return isDigikeySearchUrl(currentUrl);
  if (key === "mouser") return isMouserSearchUrl(currentUrl);
  return false;
}

function buildImportPayload(entry, vendor) {
  const vendorName =
    entry.vendorName ||
    entry.vendor ||
    vendor?.vendor ||
    vendor?.slug ||
    vendor?.key ||
    "Vendor";
  const vendorKey = (entry.vendorKey || vendor?.key || vendor?.slug || "")
    .toLowerCase()
    .trim();
  const vendorSku =
    entry.productCode ||
    entry.asin ||
    entry.sku ||
    entry.digiKeyPartNumber ||
    entry.mouserPartNumber ||
    "";
  const manufacturerPart = entry.manufacturerPartNumber || vendorSku || "";
  const partName =
    entry.description || manufacturerPart || vendorSku || "Imported Part";
  const searchUrl = buildVendorProductSearchUrl(
    vendorKey,
    vendorSku || manufacturerPart,
  );
  const partLink = entry.productUrl || searchUrl;
  const noteParts = ["Vendor import"];
  if (vendorKey === "digikey" && (entry.digiKeyPartNumber || vendorSku)) {
    noteParts.push(`Digi-Key #: ${entry.digiKeyPartNumber || vendorSku}`);
  }
  if (vendorKey === "mouser" && (entry.mouserPartNumber || vendorSku)) {
    noteParts.push(`Mouser #: ${entry.mouserPartNumber || vendorSku}`);
  }
  if (vendorKey === "shareacart" || entry.shareACartId) {
    if (entry.shareACartId) {
      noteParts.push(`Share-A-Cart ID: ${entry.shareACartId}`);
    }
    if (vendorSku) {
      const label =
        (vendorName || "").toLowerCase().includes("amazon") ? "ASIN" : "SKU";
      noteParts.push(`${label}: ${vendorSku}`);
    }
  }
  if (entry.customerReference)
    noteParts.push(`Ref: ${entry.customerReference}`);
  return {
    vendor: vendorName,
    supplier: vendorName,
    vendorPartNumber: manufacturerPart || vendorSku,
    productCode: vendorSku || undefined,
    partName,
    quantityRequested: entry.quantity || 1,
    unitCost: entry.unitPrice !== undefined ? entry.unitPrice : undefined,
    priority: defaultPriorityLabel(),
    tags: [],
    notes: noteParts.join(" · "),
    partLink,
  };
}

async function fetchVendorProductDetails(vendorKey, partNumber) {
  if (!vendorKey || !partNumber) return null;
  const body = {
    vendorKey,
    partNumber: partNumber.trim(),
  };
  try {
    const res = await fetch("/api/vendors/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Vendor lookup failed");
    return data;
  } catch (err) {
    console.warn("Vendor lookup failed", err);
    return null;
  }
}

function parsePriceNumber(text) {
  if (!text) return undefined;
  const num = parseFloat(String(text).replace(/[^0-9\\.]+/g, ""));
  return Number.isFinite(num) ? num : undefined;
}

async function parseShareACartImport(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return [];
  const res = await fetch("/api/vendors/shareacart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: trimmed }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Share-A-Cart import failed.");
  }
  const vendorName = String(data.vendorName || data.vendor || "Share-A-Cart");
  const cartId = data.cartId || undefined;
  const entries = (data.entries || [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const quantityRaw = Number(entry.quantity);
      const quantity =
        Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const unitPrice =
        entry.unitPrice !== undefined
          ? parsePriceNumber(entry.unitPrice)
          : undefined;
      const productCode = entry.productCode || entry.sku || entry.asin || "";
      const description =
        entry.description ||
        entry.title ||
        entry.name ||
        productCode ||
        "Cart item";
      let productUrl = entry.productUrl || entry.url || entry.link;
      if (
        !productUrl &&
        vendorName.toLowerCase().includes("amazon") &&
        productCode
      ) {
        productUrl = `https://www.amazon.com/dp/${encodeURIComponent(productCode)}`;
      }
      return {
        id: generateId("import"),
        vendorKey: entry.vendorKey || "shareacart",
        vendorName: entry.vendorName || vendorName,
        quantity,
        productCode: productCode || undefined,
        manufacturerPartNumber:
          entry.manufacturerPartNumber || productCode || undefined,
        description,
        productUrl,
        unitPrice,
        shareACartId: entry.shareACartId || cartId,
        source: entry.source || "share-a-cart",
      };
    })
    .filter(Boolean);
  if (!entries.length) {
    throw new Error("No items were found in that Share-A-Cart cart.");
  }
  return entries;
}

async function enrichVendorImportEntries(entries) {
  if (!entries?.length || !vendorImportVendor) return;
  const vendorKey = (
    vendorImportVendor.key ||
    vendorImportVendor.slug ||
    vendorImportVendor.vendor ||
    ""
  ).toLowerCase();
  if (!vendorKey || !["digikey", "mouser"].includes(vendorKey)) return;
  for (const entry of entries) {
    const candidatePart =
      entry.productCode ||
      entry.digiKeyPartNumber ||
      entry.mouserPartNumber ||
      entry.manufacturerPartNumber;
    if (!candidatePart) continue;
    const details = await fetchVendorProductDetails(vendorKey, candidatePart);
    if (!details) continue;
    if (!entry.description && details.picks?.name)
      entry.description = details.picks.name;
    if (
      details.productUrl &&
      shouldReplaceVendorImportUrl(entry.productUrl, vendorKey)
    ) {
      entry.productUrl = details.productUrl;
    }
    if (!entry.unitPrice) {
      const price = parsePriceNumber(details.picks?.price);
      if (price !== undefined) entry.unitPrice = price;
    }
    if (!entry.manufacturerPartNumber && details.meta?.manufacturerPartNumber) {
      entry.manufacturerPartNumber = details.meta.manufacturerPartNumber;
    }
    if (
      vendorKey === "digikey" &&
      !entry.digiKeyPartNumber &&
      details.meta?.digiKeyProductNumber
    ) {
      entry.digiKeyPartNumber = details.meta.digiKeyProductNumber;
    }
    if (
      vendorKey === "mouser" &&
      !entry.mouserPartNumber &&
      details.meta?.mouserPartNumber
    ) {
      entry.mouserPartNumber = details.meta.mouserPartNumber;
    }
    if (!entry.productCode) {
      entry.productCode =
        entry.digiKeyPartNumber || entry.mouserPartNumber || undefined;
    }
  }
}

async function handleVendorImportParse() {
  if (!canUseVendorImport()) {
    if (vendorImportMessage) {
      vendorImportMessage.textContent =
        "You do not have permission to import vendor orders.";
      vendorImportMessage.className = "small error";
    }
    return;
  }
  if (!vendorImportVendor) {
    if (vendorImportMessage) {
      vendorImportMessage.textContent = "Select a vendor before parsing.";
      vendorImportMessage.className = "small error";
    }
    return;
  }
  const file = vendorImportFile?.files?.[0];
  const pasted = vendorImportText?.value?.trim();
  if (!file && !pasted) {
    if (vendorImportMessage) {
      vendorImportMessage.textContent =
        "Choose a CSV file or paste part numbers first.";
      vendorImportMessage.className = "small error";
    }
    return;
  }
  setActionBusy(true, "Parsing import…");
  try {
    let parsed = [];
    if (isShareACartVendor(vendorImportVendor)) {
      const input = pasted || (file ? await file.text() : "");
      if (!input) {
        throw new Error("Paste a Share-A-Cart link or cart ID first.");
      }
      parsed = await parseShareACartImport(input);
    } else if (file) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext === "xls" || ext === "xlsx") {
        const workbook = await readWorkbookFromFile(file);
        parsed = parseVendorWorkbook(vendorImportVendor, workbook);
      } else {
        const text = await file.text();
        parsed = parseVendorCsv(vendorImportVendor, text);
      }
    } else if (pasted) {
      parsed = parseVendorQuickText(vendorImportVendor, pasted);
    }
    vendorImportEntries = parsed;
    if (!parsed.length) throw new Error("No valid items were found.");
    if (vendorImportMessage) {
      vendorImportMessage.textContent =
        "Parsed items. Looking up product details...";
      vendorImportMessage.className = "small";
    }
    await enrichVendorImportEntries(vendorImportEntries);
    if (vendorImportMessage) {
      vendorImportMessage.textContent = `Parsed ${parsed.length} item(s).`;
      vendorImportMessage.className = "small success";
    }
    if (vendorImportFile) vendorImportFile.value = "";
    if (vendorImportText && pasted) vendorImportText.value = "";
  } catch (err) {
    vendorImportEntries = [];
    if (vendorImportMessage) {
      vendorImportMessage.textContent =
        err.message || "Failed to parse vendor input.";
      vendorImportMessage.className = "small error";
    }
  }
  setActionBusy(false);
  renderVendorImportPreview();
}

async function submitVendorImportEntries() {
  if (!canUseVendorImport()) {
    if (vendorImportMessage) {
      vendorImportMessage.textContent =
        "You do not have permission to import vendor orders.";
      vendorImportMessage.className = "small error";
    }
    return;
  }
  if (!vendorImportVendor) {
    if (vendorImportMessage) {
      vendorImportMessage.textContent = "Select a vendor to import from.";
      vendorImportMessage.className = "small error";
    }
    return;
  }
  if (!vendorImportEntries.length) {
    if (vendorImportMessage) {
      vendorImportMessage.textContent = "No parsed items to import yet.";
      vendorImportMessage.className = "small error";
    }
    return;
  }
  setActionBusy(true, "Adding imported parts…");
  if (vendorImportMessage) {
    vendorImportMessage.textContent = "Adding items...";
    vendorImportMessage.className = "small";
  }
  const importVendorLabel =
    vendorImportEntries[0]?.vendorName ||
    vendorImportVendor?.vendor ||
    "vendor";
  let success = 0;
  const failed = [];
  for (const entry of vendorImportEntries) {
    const payload = buildImportPayload(entry, vendorImportVendor);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");
      success++;
    } catch (err) {
      failed.push(entry);
    }
  }
  if (failed.length) {
    vendorImportEntries = failed;
    if (vendorImportMessage) {
      vendorImportMessage.textContent = `Added ${success} item(s). ${failed.length} item(s) need attention.`;
      vendorImportMessage.className = "small error";
    }
    renderVendorImportPreview();
    fetchOrders();
    setActionBusy(false);
    return;
  }
  vendorImportEntries = [];
  renderVendorImportPreview();
  if (vendorImportMessage) {
    vendorImportMessage.textContent = `Added ${success} item(s) from ${importVendorLabel}.`;
    vendorImportMessage.className = "small success";
  }
  modal.style.display = "none";
  orderForm.reset();
  if (orderForm.elements.quantityRequested)
    orderForm.elements.quantityRequested.value = 1;
  resetManualVendorOverride();
  resetCatalogLookup();
  resetCatalogSavePanel();
  editingOrderId = null;
  if (orderTrackingList) setTrackingRows(orderTrackingList, []);
  setOrderSource("manual");
  fetchOrders();
  showBoardMessage(
    `Imported ${success} request(s) from ${importVendorLabel}.`,
    "success",
    2500,
  );
  setActionBusy(false);
}

function csvQuote(value) {
  const str = value === undefined || value === null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildDigikeyCartCsv(orders) {
  const header = ["Quantity", "Part Number", "Manufacturer Part Number"];
  const lines = [header].concat(
    orders.map((order) => {
      const quantity = Number(order.quantityRequested) || 1;
      const digiKeyNumber = order.productCode || order.digiKeyPartNumber || "";
      const manufacturerPart = order.vendorPartNumber || "";
      return [
        quantity,
        digiKeyNumber || manufacturerPart,
        manufacturerPart || digiKeyNumber,
      ];
    }),
  );
  return (
    "\ufeff" + lines.map((row) => row.map(csvQuote).join(",")).join("\r\n")
  );
}

function buildMouserQuickOrderCsv(orders) {
  const header = ["Order Qty", "Mouser Part Number"];
  const rows = [];
  orders.forEach((order) => {
    const mouserNumber = order.productCode || order.vendorPartNumber || "";
    if (!mouserNumber) return;
    const quantity = Number(order.quantityRequested) || 1;
    rows.push([quantity, mouserNumber]);
  });
  const lines = [header].concat(rows);
  return (
    "\ufeff" + lines.map((row) => row.map(csvQuote).join(",")).join("\r\n")
  );
}

function buildMouserQuickOrderLines(orders) {
  return orders
    .map((order) => {
      const quantity = Number(order.quantityRequested) || 1;
      const mouserNumber = order.productCode || order.vendorPartNumber || "";
      if (!mouserNumber) return null;
      return `${quantity},${mouserNumber}`;
    })
    .filter(Boolean);
}

function formatFilenameDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8;") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportOrdersForVendor(orderList, vendorNameHint) {
  if (!orderList || !orderList.length) {
    showBoardMessage("No items to export.", "error", 2500);
    return;
  }
  const vendorName =
    vendorNameHint || orderList[0]?.vendor || orderList[0]?.supplier || "";
  if (isDigikeyVendorName(vendorName)) {
    const csv = buildDigikeyCartCsv(orderList);
    downloadTextFile(
      `digikey-cart-${formatFilenameDate()}.csv`,
      csv,
      "text/csv;charset=utf-8;",
    );
    showBoardMessage("Digi-Key cart CSV downloaded.", "info", 2200);
    return;
  }
  if (isMouserVendorName(vendorName)) {
    const csv = buildMouserQuickOrderCsv(orderList);
    const lines = buildMouserQuickOrderLines(orderList);
    const skipped = orderList.length - lines.length;
    openVendorExportModal({
      vendorName: "Mouser Electronics",
      description:
        "Download the CSV or copy the Qty,PartNumber list for Mouser’s quick order form.",
      text: lines.join("\n"),
      csv,
      filename: `mouser-quick-order-${formatFilenameDate()}.csv`,
      message: skipped
        ? `${skipped} item(s) were skipped because they do not have Mouser part numbers.`
        : undefined,
      messageType: skipped ? "error" : undefined,
    });
    return;
  }
  showBoardMessage("Export not available for this vendor yet.", "error", 2500);
}
