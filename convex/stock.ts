import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function slugify(name: string) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeQuantity(val: any, fallback = 0) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return num < 0 ? 0 : num;
}

export const listSubteams = query({
  args: {},
  handler: async (ctx) => {
    const subteams = await ctx.db.query("stockSubteams").collect();
    subteams.sort((a, b) => a.name.localeCompare(b.name));
    return { subteams };
  }
});

export const list = query({
  args: {
    subteamId: v.optional(v.string()),
    search: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    catalogItemId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const subteams = await ctx.db.query("stockSubteams").collect();
    const subteamMap = new Map<string, any>();
    subteams.forEach(st => subteamMap.set(st._id.toString(), st));

    let items = await ctx.db.query("stockItems").collect();

    if (args.catalogItemId) {
      const catalogId = ctx.db.normalizeId("catalogItems", args.catalogItemId);
      if (!catalogId) {
        items = [];
      } else {
        const catStr = catalogId.toString();
        items = items.filter(i => i.catalogItemId?.toString() === catStr);
      }
    }

    if (args.subteamId) {
      const normalized = ctx.db.normalizeId("stockSubteams", args.subteamId);
      const sid = normalized?.toString();
      items = items.filter(i => {
        const current = i.subteamId ? i.subteamId.toString() : undefined;
        return sid ? current === sid : false;
      });
    }

    const catIds = Array.from(
      new Set(items.map(i => i.catalogItemId?.toString()).filter(Boolean))
    );
    const catMap = new Map<string, any>();
    await Promise.all(
      catIds.map(async idStr => {
        const id = ctx.db.normalizeId("catalogItems", idStr);
        if (!id) return;
        const item = await ctx.db.get(id);
        if (item) catMap.set(id.toString(), { ...item, _id: id });
      })
    );

    const needle = (args.search || "").toLowerCase().trim();
    if (needle) {
      items = items.filter(i => {
        const cat = i.catalogItemId ? catMap.get(i.catalogItemId.toString()) : null;
        const aliasList = Array.isArray(cat?.aliases) ? cat.aliases : [];
        const pathLabels = Array.isArray(cat?.categoryPathLabels)
          ? cat.categoryPathLabels
          : [];
        const hay = [
          i.name,
          i.vendor,
          i.vendorPartNumber,
          i.catalogFullPath,
          i.location,
          i.subteam,
          subteamMap.get(i.subteamId?.toString() || "")?.name,
          cat?.name,
          cat?.vendor,
          cat?.vendorPartNumber,
          cat?.fullPath,
          cat?.supplierLink,
          cat?.type,
          cat?.subteam,
          cat?.description,
          ...aliasList,
          ...pathLabels
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    const hydrated = items.map(i => {
      const subteam = i.subteamId ? subteamMap.get(i.subteamId.toString()) : null;
      const cat = i.catalogItemId ? catMap.get(i.catalogItemId.toString()) : null;
      const catalogOverrides = cat
        ? {
            name: cat.name,
            vendor: cat.vendor,
            vendorPartNumber: cat.vendorPartNumber,
            supplierLink: cat.supplierLink,
            unitCost: cat.unitCost,
            catalogFullPath: cat.fullPath
          }
        : {};
      return {
        ...i,
        ...catalogOverrides,
        _id: i._id,
        subteam: subteam?.name || i.subteam,
        subteamId: i.subteamId,
        catalogItem: cat
      };
    });

    hydrated.sort((a, b) => {
      const subA = (a.subteam || "").toLowerCase();
      const subB = (b.subteam || "").toLowerCase();
      if (subA !== subB) return subA.localeCompare(subB);
      return a.name.localeCompare(b.name);
    });

    return { items: hydrated, subteams };
  }
});

export const upsertSubteam = mutation({
  args: {
    id: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);
    const now = Date.now();
    const existing = await ctx.db
      .query("stockSubteams")
      .withIndex("by_slug", q => q.eq("slug", slug))
      .unique();

    const userId = args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : undefined;

    if (args.id) {
      const id = ctx.db.normalizeId("stockSubteams", args.id);
      if (!id) throw new Error("Invalid subteam id");
      const subteam = await ctx.db.get(id);
      if (!subteam) throw new Error("Subteam not found");
      if (existing && existing._id.toString() !== id.toString()) {
        throw new Error("A subteam with this name already exists");
      }
      await ctx.db.patch(id, {
        name: args.name,
        slug,
        description: args.description,
        updatedAt: now,
        updatedBy: userId ?? subteam.updatedBy
      });
      const affected = await ctx.db
        .query("stockItems")
        .withIndex("by_subteam", q => q.eq("subteamId", id))
        .collect();
      for (const item of affected) {
        await ctx.db.patch(item._id, {
          subteam: args.name,
          updatedAt: now,
          updatedBy: userId ?? item.updatedBy
        });
      }
      return { id };
    }

    if (existing) {
      throw new Error("Subteam already exists");
    }
    const id = await ctx.db.insert("stockSubteams", {
      name: args.name,
      slug,
      description: args.description,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId
    });
    return { id };
  }
});

export const deleteSubteam = mutation({
  args: { id: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("stockSubteams", args.id);
    if (!id) throw new Error("Invalid subteam id");
    const subteam = await ctx.db.get(id);
    if (!subteam) throw new Error("Subteam not found");

    const updater = args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : undefined;
    const now = Date.now();
    const affected = await ctx.db.query("stockItems").withIndex("by_subteam", q => q.eq("subteamId", id)).collect();
    for (const item of affected) {
      await ctx.db.patch(item._id, { subteamId: undefined, subteam: undefined, updatedAt: now, updatedBy: updater ?? item.updatedBy });
    }
    await ctx.db.delete(id);
    return { id, affected: affected.map(a => a._id) };
  }
});

export const create = mutation({
  args: {
    catalogItemId: v.string(),
    subteamId: v.optional(v.string()),
    quantityOnHand: v.number(),
    lowStockThreshold: v.optional(v.number()),
    location: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const catalogId = ctx.db.normalizeId("catalogItems", args.catalogItemId);
    if (!catalogId) throw new Error("Invalid catalog item id");
    const catalogItem = await ctx.db.get(catalogId);
    if (!catalogItem) throw new Error("Catalog item not found");

    const subteamId = args.subteamId ? ctx.db.normalizeId("stockSubteams", args.subteamId) : undefined;
    const subteam = subteamId ? await ctx.db.get(subteamId) : null;
    const userId = args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : undefined;
    const now = Date.now();

    const existing = await ctx.db
      .query("stockItems")
      .withIndex("by_catalogItem", q => q.eq("catalogItemId", catalogId))
      .collect();
    const duplicate = existing.find(e => (e.subteamId?.toString() || "") === (subteamId?.toString() || ""));
    if (duplicate) {
      throw new Error("Item already exists in location");
    }

    const id = await ctx.db.insert("stockItems", {
      catalogItemId: catalogId,
      name: catalogItem.name,
      vendor: catalogItem.vendor,
      vendorPartNumber: catalogItem.vendorPartNumber,
      supplierLink: catalogItem.supplierLink,
      unitCost: catalogItem.unitCost,
      catalogFullPath: catalogItem.fullPath,
      subteamId: subteamId ?? undefined,
      subteam: subteam?.name,
      location: args.location,
      category: args.category,
      quantityOnHand: normalizeQuantity(args.quantityOnHand, 0),
      lowStockThreshold: args.lowStockThreshold !== undefined ? normalizeQuantity(args.lowStockThreshold, 0) : undefined,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId
    });
    return { id };
  }
});

export const update = mutation({
  args: {
    id: v.string(),
    subteamId: v.optional(v.union(v.string(), v.null())),
    lowStockThreshold: v.optional(v.number()),
    location: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    quantityOnHand: v.optional(v.number()),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("stockItems", args.id);
    if (!id) throw new Error("Invalid stock id");
    const item = await ctx.db.get(id);
    if (!item) throw new Error("Stock item not found");

    let subteamId: any = item.subteamId;
    if (args.subteamId !== undefined) {
      if (args.subteamId === null) {
        subteamId = undefined;
      } else {
        subteamId = ctx.db.normalizeId("stockSubteams", args.subteamId);
      }
    }
    const subteam = subteamId ? await ctx.db.get(subteamId) : null;
    const userId = args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : item.updatedBy;
    const updates: any = {
      subteamId: subteamId ?? undefined,
      subteam: subteam?.name,
      updatedAt: Date.now(),
      updatedBy: userId
    };
    if (args.lowStockThreshold !== undefined) {
      updates.lowStockThreshold = normalizeQuantity(args.lowStockThreshold, 0);
    }
    if (args.location !== undefined) updates.location = args.location;
    if (args.category !== undefined) updates.category = args.category;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.quantityOnHand !== undefined) {
      updates.quantityOnHand = normalizeQuantity(args.quantityOnHand, item.quantityOnHand);
    }
    await ctx.db.patch(id, updates);
    return { id };
  }
});

export const adjustQuantity = mutation({
  args: {
    id: v.string(),
    delta: v.optional(v.number()),
    quantityOnHand: v.optional(v.number()),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("stockItems", args.id);
    if (!id) throw new Error("Invalid stock id");
    const item = await ctx.db.get(id);
    if (!item) throw new Error("Stock item not found");

    const current = item.quantityOnHand ?? 0;
    const next = args.quantityOnHand !== undefined
      ? normalizeQuantity(args.quantityOnHand, current)
      : normalizeQuantity(current + (args.delta ?? 0), current);

    await ctx.db.patch(id, {
      quantityOnHand: next,
      updatedAt: Date.now(),
      updatedBy: args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : item.updatedBy
    });
    return { id, quantityOnHand: next };
  }
});

export const remove = mutation({
  args: { id: v.string(), hard: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("stockItems", args.id);
    if (!id) throw new Error("Invalid stock id");
    await ctx.db.delete(id);
    return { id };
  }
});
