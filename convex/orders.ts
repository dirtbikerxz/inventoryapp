import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateOrderNumber } from "./utils";
import { normalizeTracking, trackingArg, trackingKey, TrackingInput } from "./trackingHelpers";

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
    groups.filter(Boolean).forEach(group => {
      if (group) groupsMap.set(group._id.toString(), group);
    });

    const trackingRefs: { carrier: string; trackingNumber: string }[] = [];
    const addRefs = (entries?: TrackingInput[]) => {
      (entries || []).forEach(t => {
        if (t.trackingNumber) {
          trackingRefs.push({ carrier: t.carrier || "unknown", trackingNumber: t.trackingNumber });
        }
      });
    };

    orders.forEach(order => addRefs(normalizeTracking(order.tracking as any, order.trackingNumber as any)));
    groups.forEach(group => group && addRefs(normalizeTracking((group as any).tracking, (group as any).trackingNumber)));

    const uniqueRefs = Array.from(new Set(trackingRefs.map(trackingKey)))
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

    const attachTracking = (entry: any) => {
      const tracking = normalizeTracking(entry.tracking as any, entry.trackingNumber as any);
      const withCache = tracking.map(t => {
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
      return { ...entry, tracking: withCache };
    };

    // Hydrate groups map
    Array.from(groupsMap.keys()).forEach(key => {
      const g = groupsMap.get(key);
      groupsMap.set(key, attachTracking(g));
    });

    const withGroups = orders.map(order => {
      const gid = order.groupId ? order.groupId.toString() : undefined;
      return {
        ...attachTracking(order),
        _id: order._id,
        group: gid ? groupsMap.get(gid) : null
      };
    });

    const hydratedGroups = Array.from(groupsMap.values()).map(g => attachTracking(g));

    return { orders: withGroups, groups: hydratedGroups };
  }
});

export const getOne = query({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("orders", args.orderId);
    if (!id) return null;
    const order = await ctx.db.get(id);
    if (!order) return null;
    const group = order.groupId ? await ctx.db.get(order.groupId) : null;
    return {
      ...order,
      _id: id,
      group: group ? { ...group, _id: group._id } : null
    };
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
    trackingNumber: v.optional(v.string()),
    tracking: v.optional(v.array(trackingArg)),
    requestedDisplayAt: v.optional(v.number()),
    approvalStatus: v.optional(v.string()),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string()))
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

    const tracking = normalizeTracking(args.tracking as any, args.trackingNumber as any);

    const orderId = await ctx.db.insert("orders", {
      ...args,
      groupId,
      orderNumber,
      requestedAt: now,
      requestedDisplayAt: args.requestedDisplayAt ?? now,
      approvalStatus: args.approvalStatus || "pending",
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
      tags: args.tags || [],
      status: args.status || "Requested",
      priority: args.priority || "Medium",
      supplier: args.supplier || args.vendor,
      totalCost: computedTotal,
      tracking,
      trackingNumber: tracking[0]?.trackingNumber || args.trackingNumber
    });

    return { orderId, orderNumber };
  }
});

export const updateStatus = mutation({
  args: {
    orderId: v.string(),
    status: v.string(),
    trackingNumber: v.optional(v.string()),
    tracking: v.optional(v.array(trackingArg))
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("orders", args.orderId);
    if (!id) throw new Error("Invalid order id");
    const order = await ctx.db.get(id);
    if (!order) throw new Error("Order not found");
    if (order.groupId) {
      // Tracking is managed at group level
      await ctx.db.patch(id, { status: args.status });
      return { orderId: id };
    }

    const updates: Record<string, any> = { status: args.status };
    if (args.tracking !== undefined || args.trackingNumber !== undefined) {
      const normalized = normalizeTracking(args.tracking as any, args.trackingNumber as any);
      updates.tracking = normalized;
      updates.trackingNumber = normalized[0]?.trackingNumber
        || args.trackingNumber
        || order.trackingNumber;
    }

    await ctx.db.patch(id, updates);

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
    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Group not found");

    const existingInGroup = await ctx.db.query("orders")
      .withIndex("by_groupId", q => q.eq("groupId", groupId))
      .collect();
    const conflicting = existingInGroup.find(o => (o.supplier || o.vendor) !== (order.supplier || order.vendor));
    if (conflicting) {
      throw new Error("Group contains different vendor orders");
    }

    const updates: Record<string, any> = { groupId };

    // If the order has tracking and group doesn't, move tracking to group and clear on order
    const orderTracking = (order as any).tracking || (order as any).trackingNumber ? normalizeTracking((order as any).tracking, (order as any).trackingNumber) : [];
    const groupTracking = (group as any).tracking || (group as any).trackingNumber ? normalizeTracking((group as any).tracking, (group as any).trackingNumber) : [];
    if (orderTracking.length && groupTracking.length === 0) {
      updates.tracking = [];
      updates.trackingNumber = undefined;
      await ctx.db.patch(groupId, {
        tracking: orderTracking,
        trackingNumber: orderTracking[0]?.trackingNumber
      });
    }

    await ctx.db.patch(orderId, updates);
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
    tracking: v.optional(v.array(trackingArg)),
    status: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    fetchedPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
    approvalStatus: v.optional(v.string()),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("orders", args.orderId);
    if (!id) throw new Error("Invalid order id");
    const updates: Record<string, any> = {};
    ["partName","quantityRequested","priority","supplier","vendor","partLink","vendorPartNumber","trackingNumber","status","unitCost","fetchedPrice","notes","approvalStatus","approvedBy","approvedAt","tags"].forEach(k => {
      const val = (args as any)[k];
      if (val !== undefined) updates[k] = val;
    });
    const order = await ctx.db.get(id);
    if (!order) throw new Error("Order not found");
    const isGrouped = Boolean(order.groupId);
    if (isGrouped) {
      // Tracking managed at group level
      delete updates.trackingNumber;
      delete updates.tracking;
    } else if (args.tracking !== undefined || args.trackingNumber !== undefined) {
      const normalized = normalizeTracking(args.tracking as any, args.trackingNumber as any);
      updates.tracking = normalized;
      updates.trackingNumber = normalized[0]?.trackingNumber || args.trackingNumber;
    }
    if (args.tracking !== undefined || args.trackingNumber !== undefined) {
      const normalized = normalizeTracking(args.tracking as any, args.trackingNumber as any);
      updates.tracking = normalized;
      updates.trackingNumber = normalized[0]?.trackingNumber || args.trackingNumber;
    }
    // Recompute total cost if price or qty changed
    if (updates.quantityRequested !== undefined || updates.unitCost !== undefined || updates.fetchedPrice !== undefined) {
      const order = await ctx.db.get(id);
      const qty = updates.quantityRequested ?? order?.quantityRequested;
      const price = updates.unitCost ?? updates.fetchedPrice ?? order?.unitCost ?? order?.fetchedPrice;
      if (qty !== undefined && price !== undefined) {
        updates.totalCost = Number((qty * price).toFixed(2));
      }
    }
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
