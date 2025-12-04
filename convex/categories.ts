import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").withIndex("by_name").collect();
    return categories.sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });
  }
});

export const upsert = mutation({
  args: {
    name: v.string(),
    code: v.optional(v.string()),
    sortOrder: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_name", q => q.eq("name", args.name))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        code: args.code,
        sortOrder: args.sortOrder
      });
      return { categoryId: existing._id };
    }

    const categoryId = await ctx.db.insert("categories", args);
    return { categoryId };
  }
});
