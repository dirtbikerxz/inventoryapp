import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "status";
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("reimbursementTags").collect();
    return items.sort((a, b) => {
      const sa = a.sortOrder ?? 0;
      const sb = b.sortOrder ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.label || "").localeCompare(b.label || "");
    });
  },
});

export const create = mutation({
  args: {
    label: v.string(),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const value = slugify(args.label);
    const exists = await ctx.db
      .query("reimbursementTags")
      .withIndex("by_value", (q) => q.eq("value", value))
      .unique();
    if (exists) throw new Error("Status label already exists");
    const id = await ctx.db.insert("reimbursementTags", {
      label: args.label,
      value,
      color: args.color,
      sortOrder: args.sortOrder,
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const update = mutation({
  args: {
    id: v.string(),
    label: v.optional(v.string()),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("reimbursementTags", args.id);
    if (!id) throw new Error("Invalid reimbursement tag id");
    const patch: any = {};
    if (args.label !== undefined) {
      patch.label = args.label;
      patch.value = slugify(args.label);
    }
    if (args.color !== undefined) patch.color = args.color;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (!Object.keys(patch).length) return { id: args.id };
    await ctx.db.patch(id, patch);
    return { id: args.id };
  },
});

export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("reimbursementTags", args.id);
    if (!id) throw new Error("Invalid reimbursement tag id");
    await ctx.db.delete(id);
    return { id: args.id };
  },
});
