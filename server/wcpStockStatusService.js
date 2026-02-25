function normalizeId(value) {
  if (!value) return "";
  if (value.toString) return value.toString();
  return String(value);
}

function normalizeSku(value) {
  if (!value) return "";
  return String(value).trim().toUpperCase();
}

function isWcpVendorName(name = "") {
  const lower = String(name || "").toLowerCase();
  return (
    lower.includes("wcp") ||
    lower.includes("wcproducts") ||
    lower.includes("west coast products")
  );
}

function stockLabel(status) {
  if (status === "in_stock") return "In Stock";
  if (status === "backordered") return "Backordered";
  if (status === "sold_out") return "Sold Out";
  return "Unknown";
}

function normalizeComparableQty(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : null;
}

class WcpStockStatusService {
  constructor({
    client,
    logger,
    lookupWcpPart,
    lookupWcpPartsBatch,
    lookupWcpQuantitiesByVariantBatch,
  }) {
    this.client = client;
    this.logger = logger;
    this.lookupWcpPart = lookupWcpPart;
    this.lookupWcpPartsBatch = lookupWcpPartsBatch;
    this.lookupWcpQuantitiesByVariantBatch = lookupWcpQuantitiesByVariantBatch;
    this.refreshMinutes = 30;
    this.timer = null;
    this.running = false;
    this.settings = {};
    this.lastError = null;
    this.orderCache = new Map();
    this.skuCache = new Map();
  }

  intervalMs() {
    return Math.max(1, Number(this.refreshMinutes) || 30) * 60 * 1000;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.runCycle().catch((err) =>
        this.logger.error(err, "WCP stock refresh failed"),
      );
    }, this.intervalMs());
    this.logger.info(
      `WCP stock refresh scheduled every ${this.refreshMinutes} minutes`,
    );
  }

  async init() {
    await this.loadSettings();
    await this.runCycle(false);
    this.start();
  }

  async loadSettings() {
    try {
      const settings = (await this.client.query("tracking:getSettings", {})) || {};
      this.settings = settings;
      const minutes = Number(settings.wcpStockRefreshMinutes);
      this.refreshMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
      return this.settings;
    } catch (error) {
      this.logger.error(error, "Failed to load WCP stock settings");
      return this.settings;
    }
  }

  isActiveWcpOrder(order) {
    if (!order) return false;
    if ((order.status || "") !== "Requested") return false;
    if (order.groupId || order.group?._id) return false;
    const vendorName = order.vendor || order.supplier || "";
    const sku = normalizeSku(order.vendorPartNumber || order.productCode);
    if (!isWcpVendorName(vendorName) && !sku.startsWith("WCP-")) return false;
    return Boolean(sku);
  }

  async collectActiveOrders() {
    const data = await this.client.query("orders:list", { status: "Requested" });
    const orders = Array.isArray(data?.orders) ? data.orders : [];
    const now = Date.now();
    const entries = orders
      .filter((order) => this.isActiveWcpOrder(order))
      .map((order) => ({
        orderId: normalizeId(order._id || order.id || order.orderId),
        sku: normalizeSku(order.vendorPartNumber || order.productCode),
        variantId:
          order.wcpVariantId !== undefined && order.wcpVariantId !== null
            ? String(order.wcpVariantId)
            : "",
        persistedSnapshot: this.snapshotFromPersistedOrder(order, now),
      }))
      .filter((entry) => entry.orderId && entry.sku);
    entries.forEach((entry) => {
      if (!entry.persistedSnapshot) return;
      const checkedAtMs = this.stockCheckedAtMs(entry.persistedSnapshot);
      this.orderCache.set(entry.orderId, {
        ...entry.persistedSnapshot,
        orderId: entry.orderId,
      });
      const existing = this.skuCache.get(entry.sku);
      const existingCheckedAt = existing
        ? this.stockCheckedAtMs(existing.snapshot)
        : -1;
      if (!existing || checkedAtMs >= existingCheckedAt) {
        this.skuCache.set(entry.sku, {
          snapshot: entry.persistedSnapshot,
          nextRefreshAt: checkedAtMs + this.intervalMs(),
        });
      }
    });
    return entries;
  }

  snapshotFromPersistedOrder(order, now) {
    if (!order) return null;
    const hasPersisted =
      order.wcpStockStatus ||
      order.wcpStockLabel ||
      Number.isFinite(Number(order.wcpInStockQty)) ||
      (order.wcpVariantId !== undefined && order.wcpVariantId !== null);
    if (!hasPersisted) return null;
    const checkedAtRaw = Number(order.wcpStockCheckedAt);
    const checkedAtMs = Number.isFinite(checkedAtRaw) ? checkedAtRaw : now;
    const checkedAt = new Date(checkedAtMs).toISOString();
    const status = order.wcpStockStatus || "unknown";
    const inStockQtyRaw = Number(order.wcpInStockQty);
    return {
      sku: normalizeSku(order.vendorPartNumber || order.productCode),
      status,
      label: order.wcpStockLabel || stockLabel(status),
      inStockQty: Number.isFinite(inStockQtyRaw)
        ? Math.max(0, Math.round(inStockQtyRaw))
        : null,
      variantId:
        order.wcpVariantId !== undefined && order.wcpVariantId !== null
          ? String(order.wcpVariantId)
          : null,
      statusSource: order.wcpStockStatusSource || null,
      quantitySource: order.wcpStockQuantitySource || null,
      checkedAt,
      error: order.wcpStockError || null,
    };
  }

  normalizeStockSnapshot(sku, details, now) {
    const stock = details?.stock || {};
    const status = stock.status || details?.meta?.stockStatus || "unknown";
    const numericQty = Number(stock.inStockQty ?? details?.meta?.stockInStockQty);
    const inStockQty = Number.isFinite(numericQty)
      ? Math.max(0, Math.round(numericQty))
      : null;
    return {
      sku,
      status,
      label: stock.label || details?.meta?.stockLabel || stockLabel(status),
      inStockQty,
      variantId:
        stock.variantId !== undefined && stock.variantId !== null
          ? String(stock.variantId)
          : details?.meta?.variantId !== undefined &&
              details?.meta?.variantId !== null
            ? String(details.meta.variantId)
            : null,
      statusSource: stock.statusSource || null,
      quantitySource: stock.quantitySource || null,
      checkedAt: stock.checkedAt || new Date(now).toISOString(),
      error: null,
    };
  }

  stockCheckedAtMs(snapshot) {
    if (!snapshot) return Date.now();
    const asNumber = Number(snapshot.checkedAt);
    if (Number.isFinite(asNumber)) return asNumber;
    const parsed = Date.parse(snapshot.checkedAt || "");
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  fallbackSnapshotForSku(sku, now, errorMessage = null) {
    const normalized = normalizeSku(sku);
    const cached = this.skuCache.get(normalized)?.snapshot;
    return cached || {
      sku: normalized,
      status: "unknown",
      label: "Unknown",
      inStockQty: null,
      variantId: null,
      statusSource: null,
      quantitySource: null,
      checkedAt: new Date(now).toISOString(),
      error: errorMessage,
    };
  }

  describeSnapshotChange(previousSnapshot, nextSnapshot) {
    if (!nextSnapshot) return null;
    const previousStatus = String(previousSnapshot?.status || "").toLowerCase() || null;
    const nextStatus = String(nextSnapshot?.status || "").toLowerCase() || "unknown";
    const previousQty = normalizeComparableQty(previousSnapshot?.inStockQty);
    const nextQty = normalizeComparableQty(nextSnapshot?.inStockQty);
    const qtyChanged = previousQty !== nextQty;
    const statusChanged = previousStatus !== nextStatus;
    if (!qtyChanged && !statusChanged) return null;
    return {
      previousStatus,
      nextStatus,
      previousQty,
      nextQty,
      qtyChanged,
      statusChanged,
    };
  }

  shouldPersistHistory(previousSnapshot, nextSnapshot) {
    if (!nextSnapshot) return false;
    if (!previousSnapshot) return true;
    const previousCheckedAt = this.stockCheckedAtMs(previousSnapshot);
    const nextCheckedAt = this.stockCheckedAtMs(nextSnapshot);
    const previousStatus = String(previousSnapshot.status || "").toLowerCase();
    const nextStatus = String(nextSnapshot.status || "").toLowerCase();
    const previousQty = normalizeComparableQty(previousSnapshot.inStockQty);
    const nextQty = normalizeComparableQty(nextSnapshot.inStockQty);
    if (nextCheckedAt !== previousCheckedAt) return true;
    if (nextStatus !== previousStatus) return true;
    return nextQty !== previousQty;
  }

  buildSnapshotFromVariantQty(
    sku,
    variantId,
    qtySnapshot,
    now,
    baselineSnapshot = null,
  ) {
    const inStockQtyRaw = Number(qtySnapshot?.inStockQty);
    if (!Number.isFinite(inStockQtyRaw)) return null;
    const inStockQty = Math.max(0, Math.round(inStockQtyRaw));
    const baselineStatus = String(baselineSnapshot?.status || "").toLowerCase();
    const status =
      inStockQty > 0
        ? "in_stock"
        : baselineStatus === "sold_out"
          ? "sold_out"
          : "backordered";
    return {
      sku,
      status,
      label: stockLabel(status),
      inStockQty,
      variantId: variantId ? String(variantId) : baselineSnapshot?.variantId || null,
      statusSource:
        status === "sold_out"
          ? baselineSnapshot?.statusSource || "shopify_product_json"
          : "wcp_cart_page",
      quantitySource: qtySnapshot?.quantitySource || "wcp_cart_page",
      checkedAt:
        qtySnapshot?.checkedAt || baselineSnapshot?.checkedAt || new Date(now).toISOString(),
      error: null,
    };
  }

  async getSkuSnapshot(sku, force = false, preferredVariantId = null) {
    const normalized = normalizeSku(sku);
    if (!normalized) return null;
    const now = Date.now();
    const cached = this.skuCache.get(normalized);
    if (!force && cached?.nextRefreshAt && cached.nextRefreshAt > now) {
      return cached.snapshot;
    }
    try {
      const details = await this.lookupWcpPart(normalized);
      const snapshot = this.normalizeStockSnapshot(normalized, details, now);
      if (!snapshot.variantId && preferredVariantId) {
        snapshot.variantId = String(preferredVariantId);
      }
      this.skuCache.set(normalized, {
        snapshot,
        nextRefreshAt: now + this.intervalMs(),
      });
      return snapshot;
    } catch (error) {
      this.lastError = error?.message || "WCP lookup failed";
      this.logger.warn({ error, sku: normalized }, "WCP stock lookup failed");
      const fallback = cached?.snapshot || {
        sku: normalized,
        status: "unknown",
        label: "Unknown",
        inStockQty: null,
        variantId: preferredVariantId ? String(preferredVariantId) : null,
        statusSource: null,
        quantitySource: null,
        checkedAt: new Date(now).toISOString(),
        error: this.lastError,
      };
      this.skuCache.set(normalized, {
        snapshot: fallback,
        nextRefreshAt: now + Math.max(this.intervalMs(), 10 * 60 * 1000),
      });
      return fallback;
    }
  }

  async refreshEntries(entries, force = false) {
    const uniqueSkus = Array.from(new Set(entries.map((entry) => entry.sku)));
    const skuSnapshots = new Map();
    const now = Date.now();
    const entryMap = new Map();
    entries.forEach((entry) => {
      const sku = normalizeSku(entry.sku);
      if (!sku) return;
      const variantId = entry.variantId ? String(entry.variantId).trim() : "";
      const row = entryMap.get(sku) || {
        sku,
        orderIds: [],
        variantIds: new Set(),
      };
      row.orderIds.push(entry.orderId);
      if (variantId) row.variantIds.add(variantId);
      const cachedVariant = this.skuCache.get(sku)?.snapshot?.variantId;
      if (cachedVariant) row.variantIds.add(String(cachedVariant));
      if (entry.persistedSnapshot?.variantId) {
        row.variantIds.add(String(entry.persistedSnapshot.variantId));
      }
      entryMap.set(sku, row);
    });

    uniqueSkus.forEach((sku) => {
      const cached = this.skuCache.get(sku);
      if (!force && cached?.nextRefreshAt && cached.nextRefreshAt > now) {
        skuSnapshots.set(sku, cached.snapshot);
      }
    });

    const unresolvedSkus = uniqueSkus.filter((sku) => !skuSnapshots.has(sku));
    if (
      unresolvedSkus.length &&
      typeof this.lookupWcpQuantitiesByVariantBatch === "function"
    ) {
      const variantToSkuMap = new Map();
      unresolvedSkus.forEach((sku) => {
        const row = entryMap.get(sku);
        (row?.variantIds || []).forEach((variantId) => {
          const normalizedVariant = String(variantId || "").trim();
          if (!normalizedVariant) return;
          const skusForVariant = variantToSkuMap.get(normalizedVariant) || new Set();
          skusForVariant.add(sku);
          variantToSkuMap.set(normalizedVariant, skusForVariant);
        });
      });
      if (variantToSkuMap.size) {
        try {
          const qtySnapshots = await this.lookupWcpQuantitiesByVariantBatch(
            Array.from(variantToSkuMap.keys()),
            { requestedQty: 1, chunkSize: 20 },
          );
          variantToSkuMap.forEach((skus, variantId) => {
            const qtySnapshot = qtySnapshots?.get
              ? qtySnapshots.get(variantId)
              : null;
            if (!qtySnapshot) return;
            skus.forEach((sku) => {
              if (skuSnapshots.has(sku)) return;
              const baseline = this.skuCache.get(sku)?.snapshot || null;
              const snapshot = this.buildSnapshotFromVariantQty(
                sku,
                variantId,
                qtySnapshot,
                now,
                baseline,
              );
              if (!snapshot) return;
              skuSnapshots.set(sku, snapshot);
              this.skuCache.set(sku, {
                snapshot,
                nextRefreshAt: now + this.intervalMs(),
              });
            });
          });
        } catch (error) {
          this.logger.warn({ error }, "WCP variant stock batch lookup failed");
        }
      }
    }

    const remainingSkus = uniqueSkus.filter((sku) => !skuSnapshots.has(sku));
    if (
      remainingSkus.length > 1 &&
      typeof this.lookupWcpPartsBatch === "function"
    ) {
      try {
        const batchResults = await this.lookupWcpPartsBatch(remainingSkus, {
          includeQty: true,
        });
        (batchResults || []).forEach((result) => {
          const sku = normalizeSku(result?.partNumber || result?.details?.meta?.sku);
          if (!sku || skuSnapshots.has(sku)) return;
          if (result?.ok && result?.details) {
            const snapshot = this.normalizeStockSnapshot(sku, result.details, now);
            skuSnapshots.set(sku, snapshot);
            this.skuCache.set(sku, {
              snapshot,
              nextRefreshAt: now + this.intervalMs(),
            });
            return;
          }
          const errorMessage = result?.error || "WCP batch lookup failed";
          this.lastError = errorMessage;
          const fallback = this.fallbackSnapshotForSku(sku, now, errorMessage);
          skuSnapshots.set(sku, fallback);
          this.skuCache.set(sku, {
            snapshot: fallback,
            nextRefreshAt: now + Math.max(this.intervalMs(), 10 * 60 * 1000),
          });
        });
      } catch (error) {
        this.logger.warn({ error }, "WCP batch stock lookup failed");
      }
    }

    for (const sku of uniqueSkus) {
      if (skuSnapshots.has(sku)) continue;
      const preferredVariantId = Array.from(entryMap.get(sku)?.variantIds || [])[0] || null;
      const snapshot = await this.getSkuSnapshot(sku, force, preferredVariantId);
      if (snapshot) skuSnapshots.set(sku, snapshot);
    }

    const activeOrderIds = new Set();
    const persistedEntries = [];
    const historyEntries = [];
    let qtyChecks = 0;
    let qtyChanges = 0;
    let statusChanges = 0;
    entries.forEach((entry) => {
      activeOrderIds.add(entry.orderId);
      const snapshot = skuSnapshots.get(entry.sku);
      if (!snapshot) return;
      const snapshotCheckedAtMs = this.stockCheckedAtMs(snapshot);
      const effectiveCheckedAtMs = force ? now : snapshotCheckedAtMs;
      const snapshotForOrder =
        force && effectiveCheckedAtMs !== snapshotCheckedAtMs
          ? { ...snapshot, checkedAt: new Date(effectiveCheckedAtMs).toISOString() }
          : snapshot;
      const previousSnapshot =
        this.orderCache.get(entry.orderId) || entry.persistedSnapshot || null;
      const change = this.describeSnapshotChange(previousSnapshot, snapshotForOrder);
      const previousQty = normalizeComparableQty(previousSnapshot?.inStockQty);
      const nextQty = normalizeComparableQty(snapshotForOrder.inStockQty);
      if (previousQty !== null || nextQty !== null) {
        qtyChecks += 1;
        const qtyChanged = previousQty !== nextQty;
        if (qtyChanged) qtyChanges += 1;
        const previousQtyLabel = previousQty === null ? "unknown" : String(previousQty);
        const nextQtyLabel = nextQty === null ? "unknown" : String(nextQty);
        this.logger.info(
          {
            orderId: entry.orderId,
            sku: entry.sku,
            previousInStockQty: previousQty,
            inStockQty: nextQty,
            qtyDelta:
              previousQty !== null && nextQty !== null
                ? nextQty - previousQty
                : null,
            qtyChanged,
            previousStatus: change?.previousStatus || null,
            status: change?.nextStatus || String(snapshotForOrder.status || "").toLowerCase() || "unknown",
            statusSource: snapshotForOrder.statusSource || null,
            quantitySource: snapshotForOrder.quantitySource || null,
            checkedAt: snapshotForOrder.checkedAt || null,
          },
          `WCP qty refreshed for ${entry.sku}: ${previousQtyLabel} -> ${nextQtyLabel}${qtyChanged ? " (changed)" : " (unchanged)"}`,
        );
      }
      if (change?.statusChanged) {
        statusChanges += 1;
        this.logger.info(
          {
            orderId: entry.orderId,
            sku: entry.sku,
            previousStatus: change.previousStatus,
            status: change.nextStatus,
            previousInStockQty: change.previousQty,
            inStockQty: change.nextQty,
            statusSource: snapshotForOrder.statusSource || null,
            quantitySource: snapshotForOrder.quantitySource || null,
            checkedAt: snapshotForOrder.checkedAt || null,
          },
          `WCP stock status updated for ${entry.sku}: ${change.previousStatus || "unknown"} -> ${change.nextStatus || "unknown"}`,
        );
      }
      this.orderCache.set(entry.orderId, {
        ...snapshotForOrder,
        orderId: entry.orderId,
      });
      persistedEntries.push({
        orderId: entry.orderId,
        wcpStockStatus: snapshotForOrder.status || "unknown",
        wcpStockLabel: snapshotForOrder.label || stockLabel(snapshotForOrder.status || "unknown"),
        wcpInStockQty:
          Number.isFinite(Number(snapshotForOrder.inStockQty))
            ? Math.max(0, Math.round(Number(snapshotForOrder.inStockQty)))
            : undefined,
        wcpVariantId: snapshotForOrder.variantId ? String(snapshotForOrder.variantId) : undefined,
        wcpStockCheckedAt: effectiveCheckedAtMs,
        wcpStockStatusSource: snapshotForOrder.statusSource || undefined,
        wcpStockQuantitySource: snapshotForOrder.quantitySource || undefined,
        wcpStockError: snapshotForOrder.error || undefined,
      });
      if (force || this.shouldPersistHistory(previousSnapshot, snapshotForOrder)) {
        historyEntries.push({
          orderId: entry.orderId,
          sku: entry.sku,
          status: snapshotForOrder.status || undefined,
          label: snapshotForOrder.label || undefined,
          inStockQty:
            Number.isFinite(Number(snapshotForOrder.inStockQty))
              ? Math.max(0, Math.round(Number(snapshotForOrder.inStockQty)))
              : undefined,
          checkedAt: effectiveCheckedAtMs,
          statusSource: snapshotForOrder.statusSource || undefined,
          quantitySource: snapshotForOrder.quantitySource || undefined,
          error: snapshotForOrder.error || undefined,
        });
      }
    });
    Array.from(this.orderCache.keys()).forEach((orderId) => {
      if (!activeOrderIds.has(orderId)) this.orderCache.delete(orderId);
    });
    if (persistedEntries.length) {
      try {
        await this.client.mutation("orders:bulkUpdateWcpStock", {
          entries: persistedEntries,
        });
      } catch (error) {
        this.logger.warn({ error }, "Failed to persist WCP stock snapshots");
      }
    }
    if (historyEntries.length) {
      try {
        await this.client.mutation("orders:recordWcpStockHistory", {
          entries: historyEntries,
        });
      } catch (error) {
        this.logger.warn({ error }, "Failed to persist WCP stock history");
      }
    }
    return {
      orderCount: entries.length,
      skuCount: uniqueSkus.length,
      qtyChecks,
      qtyChanges,
      statusChanges,
    };
  }

  async runCycle(force = false) {
    if (this.running) return { orderCount: 0, skuCount: 0 };
    this.running = true;
    try {
      await this.loadSettings();
      const entries = await this.collectActiveOrders();
      const result = await this.refreshEntries(entries, force);
      this.logger.info(
        {
          force,
          orderCount: result.orderCount || 0,
          skuCount: result.skuCount || 0,
          qtyChecks: result.qtyChecks || 0,
          qtyChanges: result.qtyChanges || 0,
          statusChanges: result.statusChanges || 0,
        },
        "WCP stock refresh completed",
      );
      return result;
    } finally {
      this.running = false;
    }
  }

  async refreshAllNow() {
    this.lastError = null;
    const result = await this.runCycle(true);
    return { ...result, lastError: this.lastError };
  }

  applySnapshotsToOrders(orders = []) {
    return (orders || []).map((order) => {
      if (!this.isActiveWcpOrder(order)) return order;
      const orderId = normalizeId(order?._id || order?.id || order?.orderId);
      if (!orderId) return order;
      const snapshot = this.orderCache.get(orderId);
      if (!snapshot) return order;
      return { ...order, wcpStock: snapshot };
    });
  }
}

module.exports = {
  WcpStockStatusService,
};
