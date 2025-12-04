import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateOrderNumber } from "./utils";

export const list = query({
  args: {
    status: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let orders;
    if (args.status) {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_status", idx => idx.eq("status", args.status))
        .collect();
    } else {
      orders = await ctx.db.query("orders").collect();
    }

    orders.sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));

    const groupIds = orders
      .map(order => order.groupId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));

    const uniqueGroupIds = Array.from(new Set(groupIds.map(id => id.toString())));

    const groups = await Promise.all(
      uniqueGroupIds.map(async (idStr) => {
        const id = ctx.db.normalizeId("orderGroups", idStr);
        if (!id) return null;
        const group = await ctx.db.get(id);
        return group ? { ...group, _id: id } : null;
      })
    );

    const groupsMap = new Map<string, any>();
    groups.filter(Boolean).forEach(group => groupsMap.set(group!._id.toString(), group));

    const withGroups = orders.map(order => {
      const gid = order.groupId ? order.groupId.toString() : undefined;
      return {
        ...order,
        _id: order._id,
        group: gid ? groupsMap.get(gid) : null
      };
    });

    return { orders: withGroups, groups: Array.from(groupsMap.values()) };
  }
});

export const create = mutation({
  args: {
    department: v.optional(v.string()),
    studentName: v.string(),
    studentId: v.optional(v.id("students")),
    partId: v.optional(v.id("parts")),
    partCode: v.optional(v.string()),
    partName: v.string(),
    vendor: v.optional(v.string()),
    vendorPartNumber: v.optional(v.string()),
    partLink: v.optional(v.string()),
    fetchedName: v.optional(v.string()),
    fetchedPrice: v.optional(v.number()),
    category: v.optional(v.string()),
    quantityRequested: v.number(),
    priority: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    supplier: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    productCode: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    justification: v.optional(v.string()),
    csvFileLink: v.optional(v.string()),
    groupId: v.optional(v.id("orderGroups")),
    trackingNumber: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const orderNumber = generateOrderNumber(new Date(now));

    const groupId = args.groupId
      ? ctx.db.normalizeId("orderGroups", args.groupId.toString())
      : undefined;

    const computedUnit = args.unitCost ?? args.fetchedPrice;
    const computedTotal = args.totalCost ?? (computedUnit !== undefined
      ? Number((computedUnit * args.quantityRequested).toFixed(2))
      : undefined);

    const orderId = await ctx.db.insert("orders", {
      ...args,
      groupId,
      orderNumber,
      requestedAt: now,
      status: args.status || "Requested",
      priority: args.priority || "Medium",
      supplier: args.supplier || args.vendor,
      totalCost: computedTotal
    });

    return { orderId, orderNumber };
  }
});

export const updateStatus = mutation({
  args: {
    orderId: v.string(),
    status: v.string(),
    trackingNumber: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("orders", args.orderId);
    if (!id) throw new Error("Invalid order id");
    const order = await ctx.db.get(id);
    if (!order) throw new Error("Order not found");

    await ctx.db.patch(id, {
      status: args.status,
      trackingNumber: args.trackingNumber ?? order.trackingNumber
    });

    return { orderId: id };
  }
});

export const assignGroup = mutation({
  args: {
    orderId: v.string(),
    groupId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const orderId = ctx.db.normalizeId("orders", args.orderId);
    if (!orderId) throw new Error("Invalid order id");

    // Ungroup
    if (!args.groupId) {
      await ctx.db.patch(orderId, { groupId: undefined });
      return { orderId, groupId: null };
    }

    const groupId = ctx.db.normalizeId("orderGroups", args.groupId);
    if (!groupId) throw new Error("Invalid group id");

    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    const existingInGroup = await ctx.db.query("orders")
      .withIndex("by_groupId", q => q.eq("groupId", groupId))
      .collect();
    const conflicting = existingInGroup.find(o => (o.supplier || o.vendor) !== (order.supplier || order.vendor));
    if (conflicting) {
      throw new Error("Group contains different vendor orders");
    }

    await ctx.db.patch(orderId, { groupId });
    return { orderId, groupId };
  }
});

export const update = mutation({
  args: {
    orderId: v.string(),
    partName: v.optional(v.string()),
    quantityRequested: v.optional(v.number()),
    priority: v.optional(v.string()),
    supplier: v.optional(v.string()),
    vendor: v.optional(v.string()),
    partLink: v.optional(v.string()),
    vendorPartNumber: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    status: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    fetchedPrice: v.optional(v.number()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("orders", args.orderId);
    if (!id) throw new Error("Invalid order id");
    const updates: Record<string, any> = {};
    ["partName","quantityRequested","priority","supplier","vendor","partLink","vendorPartNumber","trackingNumber","status","unitCost","fetchedPrice","notes"].forEach(k => {
      const val = (args as any)[k];
      if (val !== undefined) updates[k] = val;
    });
    if (Object.keys(updates).length === 0) return { orderId: id };
    await ctx.db.patch(id, updates);
    return { orderId: id };
  }
});

export const deleteOrder = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("orders", args.orderId);
    if (!id) throw new Error("Invalid order id");
    await ctx.db.delete(id);
    return { orderId: args.orderId };
  }
});
