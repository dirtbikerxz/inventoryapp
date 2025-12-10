import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

function slugify(name: string) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type Ctx = QueryCtx | MutationCtx;

async function getCategory(ctx: Ctx, idStr?: string) {
  if (!idStr) return null;
  const id = ctx.db.normalizeId("catalogCategories", idStr);
  if (!id) return null;
  return await ctx.db.get(id);
}

async function ensureCategoryPath(ctx: Ctx, names: string[], userId?: string) {
  let parentId: any = undefined;
  const trail: any[] = [];

  for (const rawName of names) {
    const name = (rawName || "").trim();
    if (!name) continue;
    const slug = slugify(name);
    const existing = await ctx.db
      .query("catalogCategories")
      .withIndex("by_parent_slug", q => q.eq("parentId", parentId).eq("slug", slug))
      .unique();
    if (existing) {
      parentId = existing._id;
      trail.push(existing);
      continue;
    }
    const now = Date.now();
    const newId = await ctx.db.insert("catalogCategories", {
      name,
      slug,
      parentId,
      path: [...trail.map(t => t.name), name],
      depth: trail.length + 1,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ? ctx.db.normalizeId("users", userId) ?? undefined : undefined
    });
    const created = await ctx.db.get(newId);
    if (created) {
      parentId = created._id;
      trail.push(created);
    }
  }

  return {
    categoryId: parentId,
    trail
  };
}

function compareIds(a: any, b: any) {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

async function updateDescendantPaths(ctx: Ctx, categories: any[], parentId: any, parentPath: string[]) {
  const children = categories.filter(c => compareIds(c.parentId, parentId));
  for (const child of children) {
    const path = [...parentPath, child.name];
    await ctx.db.patch(child._id, { path, depth: path.length });
    await updateDescendantPaths(ctx, categories, child._id, path);
  }
}

function buildPathFromLeaf(catMap: Map<string, any>, leafId: any) {
  if (!leafId) return [];
  const path: any[] = [];
  let current = leafId;
  const visited = new Set<string>();
  while (current) {
    const key = current.toString();
    if (visited.has(key)) break; // safeguard against cycles
    visited.add(key);
    const cat = catMap.get(key);
    if (!cat) break;
    path.unshift(cat);
    current = cat.parentId;
  }
  return path;
}

async function refreshItemPaths(ctx: Ctx, categoryIds: Set<string>) {
  const items = await ctx.db.query("catalogItems").collect();
  const categories = await ctx.db.query("catalogCategories").collect();
  const catMap = new Map<string, any>();
  categories.forEach(c => catMap.set(c._id.toString(), c));
  const affected = items.filter(item =>
    (item.categoryPathIds || []).some((id: any) => categoryIds.has(id?.toString())) ||
    (item.categoryId && categoryIds.has(item.categoryId.toString()))
  );
  for (const item of affected) {
    const leafId = item.categoryId || (item.categoryPathIds || []).slice(-1)[0];
    const pathCats = buildPathFromLeaf(catMap, leafId);
    const ids = pathCats.map(c => ctx.db.normalizeId("catalogCategories", c._id)) as any[];
    const labels = pathCats.map(c => c.name);
    const fullPath = labels.join(" / ");
    await ctx.db.patch(item._id, {
      categoryPathIds: ids.filter(Boolean),
      categoryPathLabels: labels,
      fullPath
    });
  }
}

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("catalogCategories").collect();
    categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    const byParent = new Map<string, any[]>();
    categories.forEach(cat => {
      const key = cat.parentId ? cat.parentId.toString() : "root";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(cat);
    });
    const build = (parentKey: string | null): any[] => {
      const list = byParent.get(parentKey || "root") || [];
      return list
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
        .map(cat => ({
          ...cat,
          children: build(cat._id.toString())
        }));
    };
    return {
      categories,
      tree: build(null)
    };
  }
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const parent = await getCategory(ctx, args.parentId);
    const parentId = parent?._id;
    const slug = slugify(args.name);
    const duplicate = await ctx.db
      .query("catalogCategories")
      .withIndex("by_parent_slug", q => q.eq("parentId", parentId).eq("slug", slug))
      .unique();
    if (duplicate) {
      throw new Error("Category already exists at this level");
    }
    const now = Date.now();
    const path = [...(parent?.path || []), args.name];
    const id = await ctx.db.insert("catalogCategories", {
      name: args.name,
      slug,
      parentId,
      path,
      depth: path.length,
      sortOrder: args.sortOrder,
      createdAt: now,
      updatedAt: now,
      createdBy: args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : undefined
    });
    const category = await ctx.db.get(id);
    return { id, category };
  }
});

export const updateCategory = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    parentId: v.optional(v.string()),
    sortOrder: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("catalogCategories", args.id);
    if (!id) throw new Error("Invalid category id");
    const cat = await ctx.db.get(id);
    if (!cat) throw new Error("Category not found");

    const parent = await getCategory(ctx, args.parentId ?? (cat.parentId ? cat.parentId.toString() : undefined));
    const parentId = parent?._id;
    if (parentId && compareIds(parentId, id)) {
      throw new Error("Category cannot be its own parent");
    }

    const name = args.name?.trim() || cat.name;
    const slug = slugify(name);
    const duplicate = await ctx.db
      .query("catalogCategories")
      .withIndex("by_parent_slug", q => q.eq("parentId", parentId).eq("slug", slug))
      .unique();
    if (duplicate && !compareIds(duplicate._id, id)) {
      throw new Error("Another category with this name exists under the selected parent");
    }

    const basePath = parent?.path || [];
    const path = [...basePath, name];
    await ctx.db.patch(id, {
      name,
      slug,
      parentId,
      path,
      depth: path.length,
      sortOrder: args.sortOrder ?? cat.sortOrder,
      updatedAt: Date.now()
    });

    // Update descendants paths
    const all = await ctx.db.query("catalogCategories").collect();
    await updateDescendantPaths(ctx, all, id, path);

    // Refresh items using this branch
    const changedIds = new Set<string>();
    const collect = (parentId: any) => {
      all.filter(c => compareIds(c.parentId, parentId)).forEach(c => {
        changedIds.add(c._id.toString());
        collect(c._id);
      });
    };
    changedIds.add(id.toString());
    collect(id);
    await refreshItemPaths(ctx, changedIds);

    return { id };
  }
});

export const deleteCategory = mutation({
  args: {
    id: v.string(),
    cascade: v.optional(v.boolean()),
    reassignTo: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("catalogCategories", args.id);
    if (!id) throw new Error("Invalid category id");
    const cat = await ctx.db.get(id);
    if (!cat) throw new Error("Category not found");

    const all = await ctx.db.query("catalogCategories").collect();
    const descendants: any[] = [];
    const walk = (parentId: any) => {
      all.filter(c => compareIds(c.parentId, parentId)).forEach(child => {
        descendants.push(child);
        walk(child._id);
      });
    };
    walk(id);
    const branchIds = new Set<string>([id.toString(), ...descendants.map(d => d._id.toString())]);

    const items = await ctx.db.query("catalogItems").collect();
    const hasItems = items.some(item =>
      (item.categoryPathIds || []).some((cid: any) => branchIds.has(cid?.toString())) ||
      (item.categoryId && branchIds.has(item.categoryId.toString()))
    );
    if (hasItems && !args.cascade) {
      throw new Error("Category has items. Use cascade or reassign items first.");
    }

    const reassignedId = args.reassignTo ? ctx.db.normalizeId("catalogCategories", args.reassignTo) : undefined;
    if (hasItems && args.cascade) {
      for (const item of items) {
        const pathIds = (item.categoryPathIds || []).filter((cid: any) => !branchIds.has(cid?.toString()));
        const newIds = reassignedId ? [...pathIds, reassignedId] : pathIds;
        const catMap = new Map<string, any>();
        all.forEach(c => catMap.set(c._id.toString(), c));
        const labels = newIds
          .map((cid: any) => cid && catMap.get(cid.toString()))
          .filter(Boolean)
          .map((c: any) => c.name);
        await ctx.db.patch(item._id, {
          categoryPathIds: newIds,
          categoryId: reassignedId ?? newIds[newIds.length - 1],
          categoryPathLabels: labels,
          fullPath: labels.join(" / "),
          updatedAt: Date.now()
        });
      }
    }

    for (const d of descendants) {
      await ctx.db.delete(d._id);
    }
    await ctx.db.delete(id);

    return { deleted: [id.toString(), ...descendants.map(d => d._id.toString())] };
  }
});

export const ensureCategoryTrail = mutation({
  args: {
    path: v.array(v.string()),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { categoryId, trail } = await ensureCategoryPath(ctx, args.path, args.userId);
    return { categoryId, trail };
  }
});

const variationInput = v.object({
  id: v.optional(v.string()),
  label: v.string(),
  vendor: v.optional(v.string()),
  vendorPartNumber: v.optional(v.string()),
  supplierLink: v.optional(v.string()),
  unitCost: v.optional(v.number()),
  notes: v.optional(v.string()),
  attributes: v.optional(v.record(v.string(), v.string()))
});

function normalizeVariations(list: any[] | undefined | null) {
  if (!Array.isArray(list)) return [];
  return list.map(v => ({
    id: v.id || Math.random().toString(36).slice(2, 10),
    label: v.label,
    vendor: v.vendor,
    vendorPartNumber: v.vendorPartNumber,
    supplierLink: v.supplierLink,
    unitCost: v.unitCost,
    notes: v.notes,
    attributes: v.attributes
  }));
}

export const listItems = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    includeDescendants: v.optional(v.boolean()),
    subteam: v.optional(v.string()),
    type: v.optional(v.string()),
    includeArchived: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const needle = (args.search || "").toLowerCase();
    const categories = await ctx.db.query("catalogCategories").collect();
    const catMap = new Map<string, any>();
    categories.forEach(c => catMap.set(c._id.toString(), c));

    let items = await ctx.db.query("catalogItems").collect();
    if (!args.includeArchived) {
      items = items.filter(i => !i.archived);
    }

    const includeDesc = args.includeDescendants === undefined ? false : Boolean(args.includeDescendants);
    let filterRoot = false;
    let filterCatIds: Set<string> | null = null;
    if (args.categoryId) {
      if (args.categoryId === "root") {
        filterRoot = true;
      } else {
        const target = ctx.db.normalizeId("catalogCategories", args.categoryId);
        if (target) {
          filterCatIds = new Set<string>([target.toString()]);
          if (includeDesc) {
            const addChildren = (parentId: any) => {
              categories
                .filter(c => compareIds(c.parentId, parentId))
                .forEach(child => {
                  filterCatIds!.add(child._id.toString());
                  addChildren(child._id);
                });
            };
            addChildren(target);
          }
        }
      }
    }

    const filtered = items.filter(item => {
      if (filterRoot) {
        if (item.categoryId || (item.categoryPathIds && item.categoryPathIds.length)) return false;
      } else if (filterCatIds) {
        const direct = item.categoryId?.toString();
        if (!includeDesc) {
          if (!direct || !filterCatIds.has(direct)) return false;
        } else {
          const ids = (item.categoryPathIds || []).map((id: any) => id?.toString());
          const match = ids.some(id => filterCatIds!.has(id || "")) || (direct && filterCatIds.has(direct));
          if (!match) return false;
        }
      }
      if (args.subteam && (item.subteam || "").toLowerCase() !== args.subteam.toLowerCase()) return false;
      if (args.type && (item.type || "").toLowerCase() !== args.type.toLowerCase()) return false;
      if (needle) {
        const hay = [
          item.name,
          item.type,
          item.subteam,
          item.vendor,
          item.vendorPartNumber,
          item.supplierLink,
          item.fullPath,
          ...(item.aliases || []),
          ...(item.categoryPathLabels || [])
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    }).map(item => {
      const labels = (item.categoryPathIds || []).map((id: any) => catMap.get(id?.toString())?.name).filter(Boolean);
      return {
        ...item,
        categoryPathLabels: labels,
        fullPath: item.fullPath || labels.join(" / ")
      };
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return { items: filtered };
  }
});

export const getItem = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("catalogItems", args.id);
    if (!id) return null;
    const item = await ctx.db.get(id);
    if (!item) return null;
    return { ...item, _id: id };
  }
});

export const createItem = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    categoryPath: v.optional(v.array(v.string())),
    subteam: v.optional(v.string()),
    type: v.optional(v.string()),
    vendor: v.optional(v.string()),
    vendorPartNumber: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    defaultQuantity: v.optional(v.number()),
    aliases: v.optional(v.array(v.string())),
    variations: v.optional(v.array(variationInput)),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let categoryId = args.categoryId ? ctx.db.normalizeId("catalogCategories", args.categoryId) : undefined;
    let trail: any[] = [];
    if ((!categoryId || !args.categoryId) && args.categoryPath?.length) {
      const ensured = await ensureCategoryPath(ctx, args.categoryPath, args.userId);
      categoryId = ensured.categoryId ? ctx.db.normalizeId("catalogCategories", ensured.categoryId) : undefined;
      trail = ensured.trail || [];
    } else if (categoryId) {
      const cat = await ctx.db.get(categoryId);
      if (cat) trail = cat.path.map((name: string, idx: number) => ({ name, _id: idx === cat.path.length - 1 ? categoryId : undefined }));
    }

    const categories = await ctx.db.query("catalogCategories").collect();
    const pathIds: any[] = [];
    const pathLabels: string[] = [];
    if (categoryId) {
      let current = categoryId;
      while (current) {
        const cat = categories.find(c => compareIds(c._id, current));
        if (!cat) break;
        pathIds.unshift(cat._id);
        pathLabels.unshift(cat.name);
        current = cat.parentId;
      }
    } else if (trail.length) {
      trail.forEach((c: any) => {
        if (c._id) pathIds.push(c._id);
        pathLabels.push(c.name);
      });
    }

    const now = Date.now();
    const itemId = await ctx.db.insert("catalogItems", {
      name: args.name,
      description: args.description,
      categoryId: categoryId ?? undefined,
      categoryPathIds: pathIds.length ? pathIds : undefined,
      categoryPathLabels: pathLabels.length ? pathLabels : undefined,
      fullPath: pathLabels.join(" / "),
      subteam: args.subteam,
      type: args.type,
      vendor: args.vendor,
      vendorPartNumber: args.vendorPartNumber,
      supplierLink: args.supplierLink,
      unitCost: args.unitCost,
      defaultQuantity: args.defaultQuantity,
      aliases: args.aliases,
      variations: normalizeVariations(args.variations),
      createdBy: args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : undefined,
      updatedBy: args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : undefined,
      createdAt: now,
      updatedAt: now,
      archived: false
    });
    return { id: itemId };
  }
});

export const updateItem = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    categoryPath: v.optional(v.array(v.string())),
    subteam: v.optional(v.string()),
    type: v.optional(v.string()),
    vendor: v.optional(v.string()),
    vendorPartNumber: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    defaultQuantity: v.optional(v.number()),
    aliases: v.optional(v.array(v.string())),
    variations: v.optional(v.array(variationInput)),
    archived: v.optional(v.boolean()),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("catalogItems", args.id);
    if (!id) throw new Error("Invalid item id");
    const item = await ctx.db.get(id);
    if (!item) throw new Error("Item not found");

    let categoryId = args.categoryId ? ctx.db.normalizeId("catalogCategories", args.categoryId) : item.categoryId;
    let pathIds = item.categoryPathIds || [];
    let pathLabels = item.categoryPathLabels || [];

    if (args.categoryPath?.length) {
      const ensured = await ensureCategoryPath(ctx, args.categoryPath, args.userId);
      categoryId = ensured.categoryId ? ctx.db.normalizeId("catalogCategories", ensured.categoryId) : categoryId;
      pathIds = ensured.trail?.map((c: any) => c._id).filter(Boolean) || pathIds;
      pathLabels = ensured.trail?.map((c: any) => c.name) || pathLabels;
    } else if (categoryId) {
      const categories = await ctx.db.query("catalogCategories").collect();
      const labels: string[] = [];
      const ids: any[] = [];
      let current = categoryId;
      while (current) {
        const cat = categories.find(c => compareIds(c._id, current));
        if (!cat) break;
        ids.unshift(cat._id);
        labels.unshift(cat.name);
        current = cat.parentId;
      }
      pathIds = ids;
      pathLabels = labels;
    }

    const updates: any = {
      updatedAt: Date.now(),
      updatedBy: args.userId ? ctx.db.normalizeId("users", args.userId) ?? undefined : item.updatedBy
    };
    [
      "name","description","subteam","type","vendor","vendorPartNumber","supplierLink","unitCost",
      "defaultQuantity","aliases"
    ].forEach(key => {
      const val = (args as any)[key];
      if (val !== undefined) updates[key] = val;
    });
    if (args.variations !== undefined) {
      updates.variations = normalizeVariations(args.variations);
    }
    if (args.archived !== undefined) updates.archived = args.archived;
    updates.categoryId = categoryId ?? undefined;
    updates.categoryPathIds = pathIds;
    updates.categoryPathLabels = pathLabels;
    updates.fullPath = pathLabels.join(" / ");

    await ctx.db.patch(id, updates);
    return { id };
  }
});

export const deleteItem = mutation({
  args: { id: v.string(), hard: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("catalogItems", args.id);
    if (!id) throw new Error("Invalid item id");
    if (args.hard) {
      await ctx.db.delete(id);
      return { id };
    }
    await ctx.db.patch(id, { archived: true, updatedAt: Date.now() });
    return { id };
  }
});
