import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("tags").collect();
  }
});

export const create = mutation({
  args: {
    label: v.string(),
    color: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const exists = await ctx.db
      .query("tags")
      .withIndex("by_label", q => q.eq("label", args.label))
      .unique();
    if (exists) throw new Error("Tag already exists");
    const id = await ctx.db.insert("tags", {
      label: args.label,
      color: args.color,
      createdAt: Date.now()
    });
    return { id };
  }
});

export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("tags", args.id);
    if (!id) throw new Error("Invalid tag id");
    await ctx.db.delete(id);
    return { id: args.id };
  }
});
