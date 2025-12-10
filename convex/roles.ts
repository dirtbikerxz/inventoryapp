import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULTS: Record<string, Record<string, boolean>> = {
  admin: {
    canPlaceOrders: true,
    canMoveOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canManageVendors: true,
    canManageUsers: true,
    canManageTags: true,
    canEditInventoryCatalog: true,
    canEditTrackingSettings: true,
    canManageStock: true,
    canEditStock: true
  },
  mentor: {
    canPlaceOrders: true,
    canMoveOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canManageVendors: true,
    canManageUsers: false,
    canManageTags: true,
    canEditInventoryCatalog: true,
    canEditTrackingSettings: true,
    canManageStock: true,
    canEditStock: true
  },
  student: {
    canPlaceOrders: true,
    canMoveOrders: false,
    canEditOrders: false,
    canDeleteOrders: false,
    canManageVendors: false,
    canManageUsers: false,
    canManageTags: false,
    canEditInventoryCatalog: false,
    canEditTrackingSettings: false,
    canManageStock: false,
    canEditStock: false
  }
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("rolePolicies").collect();
    return roles;
  }
});

export const get = query({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const policy = await ctx.db
      .query("rolePolicies")
      .withIndex("by_role", q => q.eq("role", args.role.toLowerCase()))
      .unique();
    return policy || { role: args.role, permissions: DEFAULTS[args.role.toLowerCase()] || DEFAULTS.student };
  }
});

export const upsert = mutation({
  args: {
    role: v.string(),
    permissions: v.record(v.string(), v.boolean())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rolePolicies")
      .withIndex("by_role", q => q.eq("role", args.role.toLowerCase()))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { permissions: args.permissions, updatedAt: now });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("rolePolicies", { role: args.role.toLowerCase(), permissions: args.permissions, updatedAt: now });
    return { id };
  }
});
