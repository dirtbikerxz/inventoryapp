import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("orderGroups").collect();
  }
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    supplier: v.optional(v.string()),
    status: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.number()),
    orderIds: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const groupId = await ctx.db.insert("orderGroups", {
      title: args.title,
      supplier: args.supplier,
      status: args.status || "Pending",
      trackingNumber: args.trackingNumber,
      notes: args.notes,
      expectedDate: args.expectedDate,
      createdAt: now,
      updatedAt: now
    });

    if (args.orderIds?.length) {
      for (const orderIdStr of args.orderIds) {
        const orderId = ctx.db.normalizeId("orders", orderIdStr);
        if (!orderId) continue;
        await ctx.db.patch(orderId, { groupId });
      }
    }

    return { groupId };
  }
});

export const update = mutation({
  args: {
    groupId: v.string(),
    title: v.optional(v.string()),
    supplier: v.optional(v.string()),
    status: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.number()),
    orderIds: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const groupId = ctx.db.normalizeId("orderGroups", args.groupId);
    if (!groupId) throw new Error("Invalid group id");

    const updates: Record<string, any> = {
      updatedAt: Date.now()
    };

    ["title", "supplier", "status", "trackingNumber", "notes", "expectedDate"].forEach(key => {
      const value = (args as any)[key];
      if (value !== undefined) updates[key] = value;
    });

    await ctx.db.patch(groupId, updates);

    if (args.orderIds) {
      for (const orderIdStr of args.orderIds) {
        const orderId = ctx.db.normalizeId("orders", orderIdStr);
        if (!orderId) continue;
        await ctx.db.patch(orderId, { groupId });
      }
    }

    return { groupId };
  }
});

export const remove = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const groupId = ctx.db.normalizeId("orderGroups", args.groupId);
    if (!groupId) throw new Error("Invalid group id");

    // Ungroup any orders tied to this group
    const orders = await ctx.db.query("orders").withIndex("by_groupId", q => q.eq("groupId", groupId)).collect();
    for (const order of orders) {
      await ctx.db.patch(order._id, { groupId: undefined });
    }

    await ctx.db.delete(groupId);
    return { groupId: args.groupId };
  }
});
