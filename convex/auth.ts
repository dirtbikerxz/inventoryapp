import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_PERMISSIONS = {
  canPlaceOrders: true,
  canMoveOrders: false,
  canEditOrders: false,
  canDeleteOrders: false,
  canManageVendors: false,
  canManageUsers: false,
  canManageTags: false
};

function permissionsForRole(role: string) {
  const base = { ...DEFAULT_PERMISSIONS };
  switch (role.toLowerCase()) {
    case "admin":
      return {
        canPlaceOrders: true,
        canMoveOrders: true,
        canEditOrders: true,
        canDeleteOrders: true,
        canManageVendors: true,
        canManageUsers: true,
        canManageTags: true
      };
    case "mentor":
      return {
        canPlaceOrders: true,
        canMoveOrders: true,
        canEditOrders: true,
        canDeleteOrders: true,
        canManageVendors: true,
        canManageUsers: false,
        canManageTags: true
      };
    case "student":
      return { ...DEFAULT_PERMISSIONS };
    default:
      return base;
  }
}

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map(u => ({
      ...u,
      passwordHash: undefined
    }));
  }
});

export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", args.username.toLowerCase()))
      .unique();
    if (!user) return null;
    return user;
  }
});

export const createUser = mutation({
  args: {
    username: v.string(),
    name: v.string(),
    role: v.string(),
    active: v.boolean(),
    permissions: v.optional(v.record(v.string(), v.boolean())),
    passwordHash: v.string()
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", args.username.toLowerCase()))
      .unique();
    if (existing) throw new Error("User already exists");

    const perms = args.permissions ?? {};
    const id = await ctx.db.insert("users", {
      username: args.username.toLowerCase(),
      name: args.name,
      role: args.role,
      active: args.active,
      permissions: perms,
      passwordHash: args.passwordHash,
      createdAt: now,
      updatedAt: now
    });
    return { id };
  }
});

export const updateUser = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    active: v.optional(v.boolean()),
    permissions: v.optional(v.record(v.string(), v.boolean())),
    passwordHash: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("users", args.id);
    if (!id) throw new Error("Invalid user id");
    const user = await ctx.db.get(id);
    if (!user) throw new Error("User not found");

    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.role !== undefined) {
      updates.role = args.role;
      // If permissions were not explicitly provided, reset to empty (role policies/defaults will apply on session load)
      if (args.permissions === undefined) {
        updates.permissions = {};
      }
    }
    if (args.active !== undefined) updates.active = args.active;
    if (args.permissions !== undefined) updates.permissions = args.permissions;
    if (args.passwordHash !== undefined) updates.passwordHash = args.passwordHash;

    await ctx.db.patch(id, updates);
    return { id };
  }
});

export const deleteUser = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("users", args.id);
    if (!id) throw new Error("Invalid user id");
    await ctx.db.delete(id);
    // Cleanup sessions for this user (best-effort)
    const sessions = await ctx.db.query("sessions").collect();
    await Promise.all(
      sessions
        .filter(s => s.userId === id)
        .map(s => ctx.db.delete(s._id))
    );
    return { id: args.id };
  }
});

export const createSession = mutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number()
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("sessions", {
      userId: args.userId,
      token: args.token,
      createdAt: now,
      expiresAt: args.expiresAt
    });
    return { id };
  }
});

export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", q => q.eq("token", args.token))
      .unique();
    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;
    const user = await ctx.db.get(session.userId);
    if (!user || !user.active) return null;
    return {
      sessionId: session._id,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        active: user.active,
        permissions: user.permissions
      }
    };
  }
});

export const deleteSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", q => q.eq("token", args.token))
      .unique();
    if (!session) return;
    await ctx.db.delete(session._id);
  }
});
