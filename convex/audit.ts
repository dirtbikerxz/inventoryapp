import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const auditArgs = {
  action: v.string(),
  timestamp: v.optional(v.number()),
  userId: v.optional(v.id("users")),
  userName: v.optional(v.string()),
  userRole: v.optional(v.string()),
  entityType: v.optional(v.string()),
  entityId: v.optional(v.string()),
  entityLabel: v.optional(v.string()),
  method: v.optional(v.string()),
  path: v.optional(v.string()),
  status: v.optional(v.number()),
  ip: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  metadata: v.optional(v.any())
};

export const log = mutation({
  args: auditArgs,
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("auditLogs", {
      timestamp: args.timestamp ?? now,
      action: args.action,
      userId: args.userId,
      userName: args.userName,
      userRole: args.userRole,
      entityType: args.entityType,
      entityId: args.entityId,
      entityLabel: args.entityLabel,
      method: args.method,
      path: args.path,
      status: args.status,
      ip: args.ip,
      userAgent: args.userAgent,
      metadata: args.metadata
    });
  }
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
    after: v.optional(v.number()),
    userId: v.optional(v.string()),
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    search: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const before = args.before ?? Number.MAX_SAFE_INTEGER;
    const after = args.after ?? 0;

    const normalizeTerm = (value?: string) => (value || "").toLowerCase().trim();
    const searchTerm = normalizeTerm(args.search);

    const applySearch = (log: any) => {
      if (!searchTerm) return true;
      const haystack = [
        log.action,
        log.userName,
        log.userRole,
        log.entityType,
        log.entityId,
        log.entityLabel,
        log.path,
        log.method,
        log.ip
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (log.metadata) {
        try {
          haystack.push(JSON.stringify(log.metadata).toLowerCase());
        } catch (_e) {
          // ignore metadata serialization errors
        }
      }
      return haystack.some((value) => value.includes(searchTerm));
    };

    const buildQuery = () => {
      if (args.userId) {
        const userId = ctx.db.normalizeId("users", args.userId);
        if (!userId) return null;
        return ctx.db
          .query("auditLogs")
          .withIndex("by_user_timestamp", (q) =>
            q.eq("userId", userId).gte("timestamp", after).lt("timestamp", before)
          )
          .order("desc");
      }
      if (args.action) {
        return ctx.db
          .query("auditLogs")
          .withIndex("by_action_timestamp", (q) =>
            q.eq("action", args.action as string)
              .gte("timestamp", after)
              .lt("timestamp", before)
          )
          .order("desc");
      }
      if (args.entityType) {
        return ctx.db
          .query("auditLogs")
          .withIndex("by_entity_timestamp", (q) =>
            q.eq("entityType", args.entityType as string)
              .gte("timestamp", after)
              .lt("timestamp", before)
          )
          .order("desc");
      }
      return ctx.db
        .query("auditLogs")
        .withIndex("by_timestamp", (q) =>
          q.gte("timestamp", after).lt("timestamp", before)
        )
        .order("desc");
    };

    const baseQuery = buildQuery();
    if (!baseQuery) {
      return { logs: [], nextBefore: null };
    }

    let logs = await baseQuery.take(limit + 1);
    const rawHadMore = logs.length > limit;
    const rawTail = logs[logs.length - 1];

    if (args.userId) {
      logs = logs.filter((log) => String(log.userId || "") === String(args.userId));
    }
    if (args.action) {
      logs = logs.filter((log) => String(log.action || "") === String(args.action));
    }
    if (args.entityType) {
      logs = logs.filter((log) => String(log.entityType || "") === String(args.entityType));
    }
    if (args.entityId) {
      logs = logs.filter((log) => String(log.entityId || "") === String(args.entityId));
    }

    logs = logs.filter(applySearch);

    if (logs.length > limit) logs = logs.slice(0, limit);

    const nextBefore = rawHadMore ? rawTail?.timestamp : null;

    return { logs, nextBefore };
  }
});
