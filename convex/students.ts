import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("students");
    if (args.activeOnly) {
      q = q.filter(q => q.eq(q.field("active"), true));
    }
    return q.collect();
  }
});

export const upsert = mutation({
  args: {
    name: v.string(),
    subteam: v.optional(v.string()),
    active: v.boolean()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("students")
      .withIndex("by_name", q => q.eq("name", args.name))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        subteam: args.subteam,
        active: args.active
      });
      return { studentId: existing._id };
    }

    const studentId = await ctx.db.insert("students", args);
    return { studentId };
  }
});
