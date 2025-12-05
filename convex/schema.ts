import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const trackingEntry = v.object({
  carrier: v.string(),
  trackingNumber: v.string(),
  status: v.optional(v.string()),
  lastEvent: v.optional(v.string()),
  lastUpdated: v.optional(v.number()),
  delivered: v.optional(v.boolean()),
  lastCheckedAt: v.optional(v.number()),
  trackingUrl: v.optional(v.string()),
  eta: v.optional(v.union(v.string(), v.number())),
  parts: v.optional(v.array(v.string()))
});

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
    requestedDisplayAt: v.optional(v.number()),
    approvalStatus: v.optional(v.string()), // 'pending' | 'approved'
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    department: v.optional(v.string()),
    studentName: v.string(),
    studentId: v.optional(v.id("students")),
    partId: v.optional(v.id("parts")),
    partCode: v.optional(v.string()), // original sheet Part ID
    partName: v.string(),
    vendorPartNumber: v.optional(v.string()),
    partLink: v.optional(v.string()),
    fetchedName: v.optional(v.string()),
    fetchedPrice: v.optional(v.number()),
    supplier: v.optional(v.string()),
    vendor: v.optional(v.string()),
    category: v.optional(v.string()),
    quantityRequested: v.number(),
    priority: v.string(),
    unitCost: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    supplierLink: v.optional(v.string()),
    productCode: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    justification: v.optional(v.string()),
    csvFileLink: v.optional(v.string()),
    groupId: v.optional(v.id("orderGroups")),
    trackingNumber: v.optional(v.string()),
    tracking: v.optional(v.array(trackingEntry))
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_groupId", ["groupId"])
    .index("by_status", ["status"]),

  orderGroups: defineTable({
    title: v.optional(v.string()),
    supplier: v.optional(v.string()),
    status: v.string(),
    trackingNumber: v.optional(v.string()),
    tracking: v.optional(v.array(trackingEntry)),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.number()),
    requestedDisplayAt: v.optional(v.number()),
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
  }).index("by_name", ["name"]),

  vendorConfigs: defineTable({
    vendor: v.string(),
    baseUrl: v.optional(v.string()),
    productUrlTemplate: v.optional(v.string()),
    partNumberExample: v.optional(v.string()),
    partNumberPattern: v.optional(v.string()),
    nameSelector: v.optional(v.string()),
    priceSelector: v.optional(v.string()),
    platform: v.optional(v.string()),
    notes: v.optional(v.string()),
    headers: v.optional(v.record(v.string(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_vendor", ["vendor"]),

  rolePolicies: defineTable({
    role: v.string(),
    permissions: v.record(v.string(), v.boolean()),
    updatedAt: v.number()
  }).index("by_role", ["role"]),

  tags: defineTable({
    label: v.string(),
    color: v.optional(v.string()),
    createdAt: v.number()
  }).index("by_label", ["label"]),

  users: defineTable({
    username: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.string(),
    role: v.string(),
    active: v.boolean(),
    permissions: v.record(v.string(), v.boolean()),
    passwordHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_username", ["username"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number()
  }).index("by_token", ["token"])
  ,
  trackingCache: defineTable({
    carrier: v.string(),
    trackingNumber: v.string(),
    status: v.optional(v.string()),
    summary: v.optional(v.string()),
    delivered: v.optional(v.boolean()),
    lastEventTime: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
    nextCheckAfter: v.optional(v.number()),
    eta: v.optional(v.union(v.string(), v.number())),
    trackingUrl: v.optional(v.string()),
    raw: v.optional(v.string())
  }).index("by_carrier_number", ["carrier", "trackingNumber"])
    .index("by_nextCheckAfter", ["nextCheckAfter"]),

  trackingSettings: defineTable({
    upsClientId: v.optional(v.string()),
    upsClientSecret: v.optional(v.string()),
    uspsUserId: v.optional(v.string()),
    fedexClientId: v.optional(v.string()),
    fedexClientSecret: v.optional(v.string()),
    refreshMinutes: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
});
