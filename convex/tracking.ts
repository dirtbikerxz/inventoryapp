import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const trackingRef = v.object({
  carrier: v.string(),
  trackingNumber: v.string()
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("trackingSettings").collect();
    const first = settings[0];
    if (!first) {
      return {
        refreshMinutes: 30
      };
    }
    return first;
  }
});

export const saveSettings = mutation({
  args: {
    upsClientId: v.optional(v.string()),
    upsClientSecret: v.optional(v.string()),
    uspsUserId: v.optional(v.string()),
    fedexClientId: v.optional(v.string()),
    fedexClientSecret: v.optional(v.string()),
    refreshMinutes: v.number()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("trackingSettings").collect();
    const now = Date.now();
    if (existing.length) {
      const current = existing[0];
      await ctx.db.patch(current._id, { ...args, updatedAt: now });
      return { id: current._id };
    }
    const id = await ctx.db.insert("trackingSettings", {
      ...args,
      createdAt: now,
      updatedAt: now
    });
    return { id };
  }
});

export const getCacheFor = query({
  args: { refs: v.array(trackingRef) },
  handler: async (ctx, args) => {
    const results: Record<string, any> = {};
    for (const ref of args.refs) {
      const row = await ctx.db
        .query("trackingCache")
        .withIndex("by_carrier_number", q => q.eq("carrier", ref.carrier).eq("trackingNumber", ref.trackingNumber))
        .unique();
      if (row) {
        const carrier = (row.carrier || "unknown").toLowerCase();
        results[`${carrier}:${row.trackingNumber}`] = { ...row, carrier, _id: row._id };
      }
    }
    return results;
  }
});

export const upsertCache = mutation({
  args: {
    carrier: v.string(),
    trackingNumber: v.string(),
    status: v.optional(v.string()),
    summary: v.optional(v.string()),
    delivered: v.optional(v.boolean()),
    lastEventTime: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
    nextCheckAfter: v.optional(v.number()),
    eta: v.optional(v.union(v.string(), v.number())),
    trackingUrl: v.optional(v.string()),
    raw: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const carrier = args.carrier.toLowerCase();
    const existing = await ctx.db
      .query("trackingCache")
      .withIndex("by_carrier_number", q => q.eq("carrier", carrier).eq("trackingNumber", args.trackingNumber))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, carrier });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("trackingCache", { ...args, carrier });
    return { id };
  }
});

export const dueForRefresh = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const all = await ctx.db.query("trackingCache").withIndex("by_nextCheckAfter").collect();
    const due = all
      .filter(r => r.nextCheckAfter !== undefined && r.nextCheckAfter <= now)
      .sort((a, b) => (a.nextCheckAfter || 0) - (b.nextCheckAfter || 0))
      .slice(0, args.limit || 100);
    return due;
  }
});
