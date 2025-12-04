import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  parts: defineTable({
    partId: v.string(),
    name: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    type: v.optional(v.string()),
    spec1: v.optional(v.string()),
    spec2: v.optional(v.string()),
    spec3: v.optional(v.string()),
    spec4: v.optional(v.string()),
    spec5: v.optional(v.string()),
    quantityPer: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    supplier: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    productCode: v.optional(v.string()),
    location: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    dateAdded: v.optional(v.number()),
    addedBy: v.optional(v.string())
  })
    .index("by_partId", ["partId"])
    .index("by_category", ["category"]),

  orders: defineTable({
    orderNumber: v.string(),
    requestedAt: v.number(),
    department: v.optional(v.string()),
    studentName: v.string(),
    studentId: v.optional(v.id("students")),
    partId: v.optional(v.id("parts")),
    partCode: v.optional(v.string()), // original sheet Part ID
    partName: v.string(),
    category: v.optional(v.string()),
    quantityRequested: v.number(),
    priority: v.string(),
    unitCost: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    supplier: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    productCode: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    justification: v.optional(v.string()),
    csvFileLink: v.optional(v.string()),
    groupId: v.optional(v.id("orderGroups")),
    trackingNumber: v.optional(v.string())
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_groupId", ["groupId"])
    .index("by_status", ["status"]),

  orderGroups: defineTable({
    title: v.optional(v.string()),
    supplier: v.optional(v.string()),
    status: v.string(),
    trackingNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  }),

  students: defineTable({
    name: v.string(),
    subteam: v.optional(v.string()),
    active: v.boolean()
  }).index("by_name", ["name"]),

  categories: defineTable({
    name: v.string(),
    code: v.optional(v.string()),
    sortOrder: v.optional(v.number())
  }).index("by_name", ["name"])
});
