import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    type: v.optional(v.string()),
    search: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("parts");

    if (args.category) {
      query = query.filter(q => q.eq(q.field("category"), args.category));
    }
    if (args.subcategory) {
      query = query.filter(q => q.eq(q.field("subcategory"), args.subcategory));
    }
    if (args.type) {
      query = query.filter(q => q.eq(q.field("type"), args.type));
    }

    const items = await query.collect();

    if (!args.search) return items;

    const needle = args.search.toLowerCase();
    return items.filter(part =>
      [
        part.name,
        part.partId,
        part.category,
        part.subcategory,
        part.type,
        part.productCode,
        part.supplier
      ]
        .filter(Boolean)
        .some(value => value!.toString().toLowerCase().includes(needle))
    );
  }
});

export const categories = query({
  args: {},
  handler: async (ctx) => {
    const parts = await ctx.db.query("parts").collect();
    const categories = new Set<string>();
    const subcategories = new Set<string>();
    const types = new Set<string>();

    parts.forEach(part => {
      if (part.category) categories.add(part.category);
      if (part.subcategory) subcategories.add(part.subcategory);
      if (part.type) types.add(part.type);
    });

    return {
      categories: Array.from(categories).sort(),
      subcategories: Array.from(subcategories).sort(),
      types: Array.from(types).sort()
    };
  }
});

export const create = mutation({
  args: {
    partId: v.string(),
    name: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    type: v.optional(v.string()),
    spec1: v.optional(v.string()),
    spec2: v.optional(v.string()),
    spec3: v.optional(v.string()),
    spec4: v.optional(v.string()),
    spec5: v.optional(v.string()),
    quantityPer: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    supplier: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    productCode: v.optional(v.string()),
    location: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    addedBy: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("parts")
      .withIndex("by_partId", q => q.eq("partId", args.partId))
      .unique();

    if (existing) {
      throw new Error(`Part with ID ${args.partId} already exists`);
    }

    const now = Date.now();

    return await ctx.db.insert("parts", {
      ...args,
      dateAdded: now
    });
  }
});
