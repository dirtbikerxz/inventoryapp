import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeTracking, trackingArg, trackingKey } from "./trackingHelpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("orderGroups").collect();
    const refs: { carrier: string; trackingNumber: string }[] = [];
    groups.forEach(g => {
      normalizeTracking((g as any).tracking, (g as any).trackingNumber).forEach(t => {
        if (t.trackingNumber) refs.push({ carrier: t.carrier || "unknown", trackingNumber: t.trackingNumber });
      });
    });
    const uniqueRefs = Array.from(new Set(refs.map(trackingKey)))
      .map(key => {
        const [carrier, ...rest] = key.split(":");
        return { carrier, trackingNumber: rest.join(":") };
      })
      .filter(ref => ref.trackingNumber);
    const cacheMap = new Map<string, any>();
    await Promise.all(uniqueRefs.map(async ref => {
      const row = await ctx.db
        .query("trackingCache")
        .withIndex("by_carrier_number", q => q.eq("carrier", ref.carrier).eq("trackingNumber", ref.trackingNumber))
        .unique();
      if (row) cacheMap.set(trackingKey(ref), { ...row, _id: row._id });
    }));

    return groups.map(g => {
      const tracking = normalizeTracking((g as any).tracking, (g as any).trackingNumber).map(t => {
        const cache = cacheMap.get(trackingKey(t)) || null;
        return {
          ...t,
          status: t.status || cache?.status || cache?.summary,
          eta: t.eta || cache?.eta,
          delivered: t.delivered ?? cache?.delivered,
          lastCheckedAt: t.lastCheckedAt || cache?.lastCheckedAt,
          lastUpdated: t.lastUpdated || cache?.lastEventTime || cache?.lastCheckedAt,
          cache
        };
      });
      return { ...g, tracking };
    });
  }
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    supplier: v.optional(v.string()),
    status: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    tracking: v.optional(v.array(trackingArg)),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.number()),
    orderIds: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let tracking = normalizeTracking(args.tracking as any, args.trackingNumber as any);
    const groupId = await ctx.db.insert("orderGroups", {
      title: args.title,
      supplier: args.supplier,
      status: args.status || "Pending",
      trackingNumber: tracking[0]?.trackingNumber || args.trackingNumber,
      tracking,
      notes: args.notes,
      expectedDate: args.expectedDate,
      createdAt: now,
      updatedAt: now
    });

    if (args.orderIds?.length) {
      for (const orderIdStr of args.orderIds) {
        const orderId = ctx.db.normalizeId("orders", orderIdStr);
        if (!orderId) continue;
        const order = await ctx.db.get(orderId);
        const orderTracking = order ? normalizeTracking((order as any).tracking, (order as any).trackingNumber) : [];
        // If group has no tracking yet, inherit from first order with tracking
        if (tracking.length === 0 && orderTracking.length) {
          tracking = orderTracking;
          await ctx.db.patch(groupId, {
            tracking,
            trackingNumber: tracking[0]?.trackingNumber
          });
          await ctx.db.patch(orderId, { tracking: [], trackingNumber: undefined, groupId });
        } else {
          await ctx.db.patch(orderId, { groupId });
        }
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
    tracking: v.optional(v.array(trackingArg)),
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
    if (args.tracking !== undefined || args.trackingNumber !== undefined) {
      const normalized = normalizeTracking(args.tracking as any, args.trackingNumber as any);
      updates.tracking = normalized;
      updates.trackingNumber = normalized[0]?.trackingNumber || args.trackingNumber;
    }

    await ctx.db.patch(groupId, updates);

    if (args.orderIds) {
      for (const orderIdStr of args.orderIds) {
        const orderId = ctx.db.normalizeId("orders", orderIdStr);
        if (!orderId) continue;
        const order = await ctx.db.get(orderId);
        const orderTracking = order ? normalizeTracking((order as any).tracking, (order as any).trackingNumber) : [];
        if ((updates.tracking || []).length === 0 && orderTracking.length) {
          updates.tracking = orderTracking;
          updates.trackingNumber = orderTracking[0]?.trackingNumber;
          await ctx.db.patch(groupId, { tracking: updates.tracking, trackingNumber: updates.trackingNumber });
          await ctx.db.patch(orderId, { tracking: [], trackingNumber: undefined });
        }
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
