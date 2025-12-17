import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const invoiceFileArg = v.object({
  name: v.string(),
  mimeType: v.string(),
  size: v.optional(v.number()),
  driveFileId: v.optional(v.string()),
  driveWebViewLink: v.optional(v.string()),
  driveDownloadLink: v.optional(v.string()),
  detectedTotal: v.optional(v.number()),
  detectedCurrency: v.optional(v.string()),
  detectedDate: v.optional(v.union(v.number(), v.string())),
  detectedMerchant: v.optional(v.string()),
  textSnippet: v.optional(v.string())
});

const statusEntryArg = v.object({
  status: v.string(),
  changedAt: v.number(),
  changedBy: v.optional(v.id("users")),
  changedByName: v.optional(v.string()),
  note: v.optional(v.string())
});

export const list = query({
  args: {
    orderId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    status: v.optional(v.string()),
    reimbursementOnly: v.optional(v.boolean()),
    requestedBy: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let rows: any[] = [];
    if (args.orderId) {
      const oid = ctx.db.normalizeId("orders", args.orderId);
      if (!oid) return [];
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_orderId", (q) => q.eq("orderId", oid))
        .collect();
    } else if (args.groupId) {
      const gid = ctx.db.normalizeId("orderGroups", args.groupId);
      if (!gid) return [];
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_groupId", (q) => q.eq("groupId", gid))
        .collect();
    } else if (args.status) {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_status", (q) => q.eq("reimbursementStatus", args.status as string))
        .collect();
    } else {
      rows = await ctx.db.query("invoices").collect();
    }

    let filtered = rows;
    if (args.requestedBy) {
      filtered = filtered.filter(
        (row) => row.requestedBy && row.requestedBy.toString() === args.requestedBy
      );
    }
    if (args.reimbursementOnly) {
      filtered = filtered.filter((row) => row.reimbursementRequested || row.reimbursementStatus !== "not_requested");
    }
    if (args.status) {
      filtered = filtered.filter((row) => row.reimbursementStatus === args.status);
    }

    return filtered
      .map((row) => ({ ...row, _id: row._id }))
      .sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));
  }
});

export const listForOrders = query({
  args: { orderIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const unique = Array.from(new Set(args.orderIds || []));
    const results: any[] = [];
    for (const idStr of unique) {
      const oid = ctx.db.normalizeId("orders", idStr);
      if (!oid) continue;
      const rows = await ctx.db
        .query("invoices")
        .withIndex("by_orderId", (q) => q.eq("orderId", oid))
        .collect();
      rows.forEach((row) => results.push({ ...row, _id: row._id }));
    }
    return results;
  }
});

export const get = query({
  args: { invoiceId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("invoices", args.invoiceId);
    if (!id) return null;
    const row = await ctx.db.get(id);
    return row ? { ...row, _id: row._id } : null;
  }
});

export const create = mutation({
  args: {
    orderId: v.string(),
    groupId: v.optional(v.string()),
    orderNumber: v.optional(v.string()),
    groupTitle: v.optional(v.string()),
    vendor: v.optional(v.string()),
    studentName: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
    requestedByName: v.optional(v.string()),
    requestedAt: v.optional(v.number()),
    amount: v.optional(v.number()),
    reimbursementAmount: v.optional(v.number()),
    reimbursementRequested: v.boolean(),
    reimbursementStatus: v.optional(v.string()),
    reimbursementUser: v.optional(v.string()),
    reimbursementUserName: v.optional(v.string()),
    detectedTotal: v.optional(v.number()),
    detectedCurrency: v.optional(v.string()),
    detectedDate: v.optional(v.union(v.number(), v.string())),
    detectedMerchant: v.optional(v.string()),
    notes: v.optional(v.string()),
    files: v.array(invoiceFileArg)
  },
  handler: async (ctx, args) => {
    const now = args.requestedAt ?? Date.now();
    const orderId = ctx.db.normalizeId("orders", args.orderId);
    if (!orderId) throw new Error("Invalid order id");
    const groupId = args.groupId ? ctx.db.normalizeId("orderGroups", args.groupId) : undefined;
    const requestedBy = args.requestedBy ? ctx.db.normalizeId("users", args.requestedBy) : undefined;
    const status = args.reimbursementStatus || (args.reimbursementRequested ? "requested" : "not_requested");
    const statusHistory = [
      {
        status,
        changedAt: now,
        changedBy: requestedBy,
        changedByName: args.requestedByName
      }
    ];
    const id = await ctx.db.insert("invoices", {
      orderId,
      groupId,
      orderNumber: args.orderNumber,
      groupTitle: args.groupTitle,
      vendor: args.vendor,
      studentName: args.studentName,
      requestedBy,
      requestedByName: args.requestedByName,
      requestedAt: now,
      amount: args.amount,
      reimbursementAmount: args.reimbursementAmount ?? args.amount ?? args.detectedTotal,
      reimbursementRequested: args.reimbursementRequested,
      reimbursementStatus: status,
      reimbursementUser: args.reimbursementUser,
      reimbursementUserName: args.reimbursementUserName,
      detectedTotal: args.detectedTotal,
      detectedCurrency: args.detectedCurrency,
      detectedDate: args.detectedDate,
      detectedMerchant: args.detectedMerchant,
      notes: args.notes,
      files: args.files,
      statusHistory,
      updatedAt: now
    });
    return { invoiceId: id };
  }
});

export const update = mutation({
  args: {
    invoiceId: v.string(),
    amount: v.optional(v.number()),
    reimbursementAmount: v.optional(v.number()),
    reimbursementRequested: v.optional(v.boolean()),
    reimbursementStatus: v.optional(v.string()),
    reimbursementUser: v.optional(v.string()),
    reimbursementUserName: v.optional(v.string()),
    notes: v.optional(v.string()),
    statusNote: v.optional(v.string()),
    changedBy: v.optional(v.string()),
    changedByName: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("invoices", args.invoiceId);
    if (!id) throw new Error("Invalid invoice id");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Invoice not found");
    const updates: Record<string, any> = { updatedAt: Date.now() };
    const keys: (keyof typeof args)[] = ["amount", "reimbursementAmount", "reimbursementRequested", "notes"];
    keys.forEach((key) => {
      const val = args[key];
      if (val !== undefined) updates[key] = val;
    });
    const statusHistory: any[] = Array.isArray(existing.statusHistory) ? [...existing.statusHistory] : [];
  if (args.reimbursementStatus) {
    updates.reimbursementStatus = args.reimbursementStatus;
    statusHistory.push({
      status: args.reimbursementStatus,
      changedAt: updates.updatedAt,
      changedBy: args.changedBy ? ctx.db.normalizeId("users", args.changedBy) : undefined,
      changedByName: args.changedByName,
      note: args.statusNote
    });
    updates.statusHistory = statusHistory;
  }
  if (args.reimbursementUser !== undefined) {
    updates.reimbursementUser = args.reimbursementUser;
    updates.reimbursementUserName = args.reimbursementUserName;
  }
  if (args.reimbursementRequested === false) {
    updates.reimbursementStatus = "not_requested";
    statusHistory.push({
      status: "not_requested",
      changedAt: updates.updatedAt,
      changedBy: args.changedBy ? ctx.db.normalizeId("users", args.changedBy) : undefined,
      changedByName: args.changedByName,
      note: args.statusNote
    });
    updates.statusHistory = statusHistory;
  }
  await ctx.db.patch(id, updates);
  return { invoiceId: id };
}
});

export const remove = mutation({
  args: { invoiceId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("invoices", args.invoiceId);
    if (!id) throw new Error("Invalid invoice id");
    await ctx.db.delete(id);
    return { invoiceId: args.invoiceId };
  }
});
