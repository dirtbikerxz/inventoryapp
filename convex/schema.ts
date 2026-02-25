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

const catalogVariation = v.object({
  id: v.string(),
  label: v.string(),
  vendor: v.optional(v.string()),
  vendorPartNumber: v.optional(v.string()),
  supplierLink: v.optional(v.string()),
  unitCost: v.optional(v.number()),
  notes: v.optional(v.string()),
  attributes: v.optional(v.record(v.string(), v.string()))
});

const invoiceFile = v.object({
  name: v.string(),
  mimeType: v.string(),
  size: v.optional(v.number()),
  driveFileId: v.optional(v.string()),
  driveWebViewLink: v.optional(v.string()),
  driveDownloadLink: v.optional(v.string()),
  detectedTotal: v.optional(v.number()),
  detectedCurrency: v.optional(v.string()),
  detectedDate: v.optional(v.union(v.number(), v.string())),
  detectedMerchant: v.optional(v.string()),
  textSnippet: v.optional(v.string())
});

const invoiceStatusEntry = v.object({
  status: v.string(),
  changedAt: v.number(),
  changedBy: v.optional(v.id("users")),
  changedByName: v.optional(v.string()),
  note: v.optional(v.string())
});

const shareACartItem = v.object({
  title: v.optional(v.string()),
  quantity: v.optional(v.number()),
  unitPrice: v.optional(v.number()),
  productCode: v.optional(v.string()),
  productUrl: v.optional(v.string())
});

const googleCredentials = defineTable({
  projectId: v.optional(v.string()),
  clientEmail: v.optional(v.string()),
  privateKey: v.optional(v.string()),
  rawJson: v.optional(v.string()),
  folderId: v.optional(v.string()),
  updatedAt: v.number(),
  updatedBy: v.optional(v.id("users"))
});

export default defineSchema({
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
    studentId: v.optional(v.string()),
    partCode: v.optional(v.string()), // original sheet Part ID
    partName: v.string(),
    vendorPartNumber: v.optional(v.string()),
    partLink: v.optional(v.string()),
    shareACartItems: v.optional(v.array(shareACartItem)),
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

  invoices: defineTable({
    orderId: v.id("orders"),
    groupId: v.optional(v.id("orderGroups")),
    orderNumber: v.optional(v.string()),
    groupTitle: v.optional(v.string()),
  vendor: v.optional(v.string()),
    studentName: v.optional(v.string()),
    requestedBy: v.optional(v.id("users")),
    requestedByName: v.optional(v.string()),
    requestedAt: v.number(),
    amount: v.optional(v.number()),
  reimbursementAmount: v.optional(v.number()),
  reimbursementRequested: v.boolean(),
  reimbursementStatus: v.string(),
  reimbursementUser: v.optional(v.string()),
  reimbursementUserName: v.optional(v.string()),
  detectedTotal: v.optional(v.number()),
    detectedCurrency: v.optional(v.string()),
    detectedDate: v.optional(v.union(v.number(), v.string())),
    detectedMerchant: v.optional(v.string()),
    notes: v.optional(v.string()),
    files: v.array(invoiceFile),
    statusHistory: v.optional(v.array(invoiceStatusEntry)),
    updatedAt: v.number()
  }).index("by_orderId", ["orderId"])
    .index("by_groupId", ["groupId"])
    .index("by_status", ["reimbursementStatus"]),

  googleCredentials,

  orderGroups: defineTable({
    title: v.optional(v.string()),
    supplier: v.optional(v.string()),
    status: v.string(),
    trackingNumber: v.optional(v.string()),
    tracking: v.optional(v.array(trackingEntry)),
    notes: v.optional(v.string()),
    statusTag: v.optional(v.string()),
    expectedDate: v.optional(v.number()),
    requestedDisplayAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  }),

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

  vendorIntegrations: defineTable({
    vendorKey: v.string(),
    settings: v.optional(v.record(v.string(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
    updatedBy: v.optional(v.id("users"))
  }).index("by_vendorKey", ["vendorKey"]),

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

  priorityTags: defineTable({
    label: v.string(),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    createdAt: v.number()
  }).index("by_label", ["label"]),

  statusTags: defineTable({
    label: v.string(),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    createdAt: v.number()
  }).index("by_label", ["label"]),

  reimbursementTags: defineTable({
    label: v.string(),
    value: v.string(),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    createdAt: v.number()
  }).index("by_value", ["value"]),

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
  auditLogs: defineTable({
    timestamp: v.number(),
    action: v.string(),
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
  }).index("by_timestamp", ["timestamp"])
    .index("by_user_timestamp", ["userId", "timestamp"])
    .index("by_action_timestamp", ["action", "timestamp"])
    .index("by_entity_timestamp", ["entityType", "timestamp"]),
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
    wcpStockRefreshMinutes: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
  ,
  catalogCategories: defineTable({
    name: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("catalogCategories")),
    path: v.array(v.string()),
    depth: v.number(),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users"))
  }).index("by_parent_slug", ["parentId", "slug"])
    .index("by_parent", ["parentId"]),

  catalogItems: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    categoryPathIds: v.optional(v.array(v.id("catalogCategories"))),
    categoryPathLabels: v.optional(v.array(v.string())),
    categoryId: v.optional(v.id("catalogCategories")),
    fullPath: v.optional(v.string()),
    subteam: v.optional(v.string()),
    type: v.optional(v.string()),
    vendor: v.optional(v.string()),
    vendorPartNumber: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    defaultQuantity: v.optional(v.number()),
  aliases: v.optional(v.array(v.string())),
  variations: v.optional(v.array(catalogVariation)),
  createdBy: v.optional(v.id("users")),
  updatedBy: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
  archived: v.optional(v.boolean())
  }).index("by_category", ["categoryId"])
    .index("by_name", ["name"])
  ,

  stockSubteams: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
    updatedBy: v.optional(v.id("users"))
  }).index("by_slug", ["slug"]),

  stockItems: defineTable({
    catalogItemId: v.id("catalogItems"),
    name: v.string(),
    vendor: v.optional(v.string()),
    vendorPartNumber: v.optional(v.string()),
    supplierLink: v.optional(v.string()),
    unitCost: v.optional(v.number()),
  catalogFullPath: v.optional(v.string()),
  subteamId: v.optional(v.id("stockSubteams")),
  subteam: v.optional(v.string()),
  location: v.optional(v.string()),
  category: v.optional(v.string()),
  quantityOnHand: v.number(),
  usedQuantity: v.optional(v.number()),
  trackUsedStock: v.optional(v.boolean()),
  lowStockThreshold: v.optional(v.number()),
  notes: v.optional(v.string()),
  createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
    updatedBy: v.optional(v.id("users"))
  }).index("by_catalogItem", ["catalogItemId"])
    .index("by_subteam", ["subteamId"])
});
