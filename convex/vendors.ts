import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("vendorConfigs").collect();
  }
});

export const upsert = mutation({
  args: {
    id: v.optional(v.string()),
    vendor: v.string(),
    baseUrl: v.optional(v.string()),
    productUrlTemplate: v.optional(v.string()),
    partNumberExample: v.optional(v.string()),
    partNumberPattern: v.optional(v.string()),
    nameSelector: v.optional(v.string()),
    priceSelector: v.optional(v.string()),
    stockSelector: v.optional(v.string()),
    notes: v.optional(v.string()),
    headers: v.optional(v.record(v.string(), v.string()))
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.id) {
      const id = ctx.db.normalizeId("vendorConfigs", args.id);
      if (!id) throw new Error("Invalid vendor config id");
      await ctx.db.patch(id, {
        vendor: args.vendor,
        baseUrl: args.baseUrl,
        productUrlTemplate: args.productUrlTemplate,
        partNumberExample: args.partNumberExample,
        partNumberPattern: args.partNumberPattern,
        nameSelector: args.nameSelector,
        priceSelector: args.priceSelector,
        stockSelector: args.stockSelector,
        notes: args.notes,
        headers: args.headers,
        updatedAt: now
      });
      return { id };
    }

    const exists = await ctx.db
      .query("vendorConfigs")
      .withIndex("by_vendor", q => q.eq("vendor", args.vendor))
      .unique();
    if (exists) throw new Error("Vendor config already exists");

    const id = await ctx.db.insert("vendorConfigs", {
      vendor: args.vendor,
      baseUrl: args.baseUrl,
      productUrlTemplate: args.productUrlTemplate,
      partNumberExample: args.partNumberExample,
      partNumberPattern: args.partNumberPattern,
      nameSelector: args.nameSelector,
      priceSelector: args.priceSelector,
      stockSelector: args.stockSelector,
      notes: args.notes,
      headers: args.headers,
      createdAt: now,
      updatedAt: now
    });
    return { id };
  }
});

export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("vendorConfigs", args.id);
    if (!id) throw new Error("Invalid vendor config id");
    await ctx.db.delete(id);
    return { id: args.id };
  }
});
