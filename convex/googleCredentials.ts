import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("googleCredentials").first();
    return row ? { ...row, _id: row._id } : null;
  }
});

export const save = mutation({
  args: {
    projectId: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    privateKey: v.optional(v.string()),
    rawJson: v.optional(v.string()),
    folderId: v.optional(v.string()),
    updatedBy: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updatedBy = args.updatedBy ? ctx.db.normalizeId("users", args.updatedBy) : undefined;
    const existing = await ctx.db.query("googleCredentials").first();
    const payload = {
      projectId: args.projectId,
      clientEmail: args.clientEmail,
      privateKey: args.privateKey,
      rawJson: args.rawJson,
      folderId: args.folderId,
      updatedAt: now,
      updatedBy
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { _id: existing._id };
    }
    const id = await ctx.db.insert("googleCredentials", payload);
    return { _id: id };
  }
});
