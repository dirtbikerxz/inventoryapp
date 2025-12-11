import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("vendorIntegrations").collect();
  }
});

export const get = query({
  args: { vendorKey: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("vendorIntegrations")
      .withIndex("by_vendorKey", q => q.eq("vendorKey", args.vendorKey))
      .unique();
  }
});

export const save = mutation({
  args: {
    vendorKey: v.string(),
    settings: v.optional(v.record(v.string(), v.string())),
    userId: v.optional(v.id("users"))
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const settings = args.settings || {};
    const existing = await ctx.db
      .query("vendorIntegrations")
      .withIndex("by_vendorKey", q => q.eq("vendorKey", args.vendorKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        settings,
        updatedAt: now,
        updatedBy: args.userId
      });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("vendorIntegrations", {
      vendorKey: args.vendorKey,
      settings,
      createdAt: now,
      updatedAt: now,
      createdBy: args.userId,
      updatedBy: args.userId
    });
    return { id };
  }
});
