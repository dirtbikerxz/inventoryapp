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

    const computedTotal = args.totalCost ?? (args.unitCost !== undefined
      ? Number((args.unitCost * args.quantityRequested).toFixed(2))
      : undefined);

    const orderId = await ctx.db.insert("orders", {
      ...args,
      groupId,
      orderNumber,
      requestedAt: now,
      status: args.status || "Requested",
      priority: args.priority || "Medium",
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
    groupId: v.string()
  },
  handler: async (ctx, args) => {
    const orderId = ctx.db.normalizeId("orders", args.orderId);
    if (!orderId) throw new Error("Invalid order id");
    const groupId = ctx.db.normalizeId("orderGroups", args.groupId);
    if (!groupId) throw new Error("Invalid group id");

    await ctx.db.patch(orderId, { groupId });
    return { orderId, groupId };
  }
});
