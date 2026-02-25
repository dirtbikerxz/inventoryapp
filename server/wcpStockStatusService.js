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

class WcpStockStatusService {
  constructor({ client, logger, lookupWcpPart }) {
    this.client = client;
    this.logger = logger;
    this.lookupWcpPart = lookupWcpPart;
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
    await this.runCycle(true);
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
    return orders
      .filter((order) => this.isActiveWcpOrder(order))
      .map((order) => ({
        orderId: normalizeId(order._id || order.id || order.orderId),
        sku: normalizeSku(order.vendorPartNumber || order.productCode),
      }))
      .filter((entry) => entry.orderId && entry.sku);
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
      statusSource: stock.statusSource || null,
      quantitySource: stock.quantitySource || null,
      checkedAt: stock.checkedAt || new Date(now).toISOString(),
      error: null,
    };
  }

  async getSkuSnapshot(sku, force = false) {
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
    for (const sku of uniqueSkus) {
      const snapshot = await this.getSkuSnapshot(sku, force);
      if (snapshot) skuSnapshots.set(sku, snapshot);
    }
    const activeOrderIds = new Set();
    entries.forEach((entry) => {
      activeOrderIds.add(entry.orderId);
      const snapshot = skuSnapshots.get(entry.sku);
      if (!snapshot) return;
      this.orderCache.set(entry.orderId, {
        ...snapshot,
        orderId: entry.orderId,
      });
    });
    Array.from(this.orderCache.keys()).forEach((orderId) => {
      if (!activeOrderIds.has(orderId)) this.orderCache.delete(orderId);
    });
    return {
      orderCount: entries.length,
      skuCount: uniqueSkus.length,
    };
  }

  async runCycle(force = false) {
    if (this.running) return { orderCount: 0, skuCount: 0 };
    this.running = true;
    try {
      await this.loadSettings();
      const entries = await this.collectActiveOrders();
      return await this.refreshEntries(entries, force);
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
