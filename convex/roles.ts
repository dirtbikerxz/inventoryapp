import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULTS: Record<string, Record<string, boolean>> = {
  admin: {
    canPlacePartRequests: true,
    canManageOwnPartRequests: true,
    canManagePartRequests: true,
    canManageOrders: true,
    canManageVendors: true,
    canManageUsers: true,
    canManageTags: true,
    canEditInventoryCatalog: true,
    canEditTrackingSettings: true,
    canManageStock: true,
    canEditStock: true,
    notesNotRequired: true,
    canImportBulkOrders: true,
    canSubmitInvoices: true,
    canViewInvoices: true,
    canManageInvoices: true,
    canManageGoogleCredentials: true
  },
  mentor: {
    canPlacePartRequests: true,
    canManageOwnPartRequests: true,
    canManagePartRequests: true,
    canManageOrders: true,
    canManageVendors: false,
    canManageUsers: false,
    canManageTags: true,
    canEditInventoryCatalog: true,
    canEditTrackingSettings: false,
    canManageStock: true,
    canEditStock: true,
    notesNotRequired: true,
    canImportBulkOrders: false,
    canSubmitInvoices: true,
    canViewInvoices: false,
    canManageInvoices: false,
    canManageGoogleCredentials: false
  },
  student: {
    canPlacePartRequests: true,
    canManageOwnPartRequests: true,
    canManagePartRequests: false,
    canManageOrders: false,
    canManageVendors: false,
    canManageUsers: false,
    canManageTags: false,
    canEditInventoryCatalog: false,
    canEditTrackingSettings: false,
    canManageStock: true,
    canEditStock: false,
    notesNotRequired: false,
    canImportBulkOrders: false,
    canSubmitInvoices: true,
    canViewInvoices: false,
    canManageInvoices: false,
    canManageGoogleCredentials: false
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
