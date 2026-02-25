const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const pino = require('pino');
const { ConvexHttpClient } = require('convex/browser');
const { TrackingService, buildTrackingUrl } = require('./trackingService');
const { WcpStockStatusService } = require('./wcpStockStatusService');
const { DigiKeyService } = require('./digikeyService');
const { MouserService } = require('./mouserService');
const { builtinVendors, getBuiltinVendor } = require('./builtinVendors');
const { InvoiceService } = require('./invoiceService');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  }
});

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  convexUrl: process.env.CONVEX_URL,
  sessionCookie: 'session_token',
  sessionDays: 7
};

if (!config.convexUrl) {
  throw new Error('CONVEX_URL is required to talk to Convex backend.');
}

const client = new ConvexHttpClient(config.convexUrl);
const app = express();
const trackingService = new TrackingService({ client, logger });
const stockStatusService = new WcpStockStatusService({
  client,
  logger,
  lookupWcpPart: (partNumber) => lookupWcpPart(partNumber),
  lookupWcpPartsBatch: (partNumbers, options) =>
    lookupWcpPartsBatch(partNumbers, options),
  lookupWcpQuantitiesByVariantBatch: (variantIds, options = {}) =>
    scrapeWcpQuantitiesViaCartBatch(
      variantIds,
      Number.isFinite(Number(options.requestedQty))
        ? Math.max(1, Math.round(Number(options.requestedQty)))
        : WCP_QTY_PROBE,
      Number.isFinite(Number(options.chunkSize))
        ? Math.max(1, Math.round(Number(options.chunkSize)))
        : 20
    )
});
const digikeyService = new DigiKeyService({ logger });
const mouserService = new MouserService({ logger });
const invoiceService = new InvoiceService({ logger });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 8 } });

async function syncGoogleCredentialsFromStore() {
  try {
    const stored = await client.query('googleCredentials:get', {});
    if (stored) {
      invoiceService.updateCredentials({
        folderId: stored.folderId,
        clientEmail: stored.clientEmail,
        privateKey: stored.privateKey,
        projectId: stored.projectId
      });
    }
  } catch (err) {
    logger.warn(err, 'Unable to load stored Google credentials');
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function defaultPermissions(role) {
  const base = {
    canPlacePartRequests: true,
    canManageOwnPartRequests: false,
    canManagePartRequests: false,
    canManageOrders: false,
    canManageVendors: false,
    canManageUsers: false,
    canManageTags: false,
    canEditInventoryCatalog: false,
    canEditTrackingSettings: false,
    canManageStock: false,
    canEditStock: false,
    notesNotRequired: false,
    canImportBulkOrders: false,
    canManageGoogleCredentials: false,
    canSubmitInvoices: false,
    canViewInvoices: false,
    canManageInvoices: false,
    canViewAuditLog: false
  };
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return {
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
        canManageGoogleCredentials: true,
        canViewAuditLog: true
      };
    case 'mentor':
      return {
        canPlacePartRequests: true,
        canManageOwnPartRequests: true,
        canManagePartRequests: true,
        canManageOrders: true,
        canManageVendors: true,
        canManageUsers: false,
        canManageTags: true,
        canEditInventoryCatalog: true,
        canEditTrackingSettings: true,
        canManageStock: true,
        canEditStock: true,
        notesNotRequired: true,
        canImportBulkOrders: false,
        canSubmitInvoices: true,
        canViewInvoices: false,
        canManageInvoices: false,
        canManageGoogleCredentials: false,
        canViewAuditLog: false
      };
    case 'student':
      return {
        ...base,
        canSubmitInvoices: true
      };
    default:
      return base;
  }
}

function parseBoolean(input) {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    const lowered = input.toLowerCase();
    return lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on';
  }
  return false;
}

function normalizePrivateKey(key) {
  if (!key) return null;
  return String(key).replace(/\\n/g, '\n');
}

const baseReimbursementStatus = {
  label: 'No Reimbursement',
  value: 'no_reimbursement',
  color: '#888888',
  sortOrder: -999
};

function cleanInvoiceFile(file) {
  if (!file || typeof file !== 'object') return file;
  const allowed = [
    'detectedCurrency',
    'detectedDate',
    'detectedMerchant',
    'detectedTotal',
    'driveDownloadLink',
    'driveFileId',
    'driveWebViewLink',
    'mimeType',
    'name',
    'size',
    'textSnippet'
  ];
  const cleaned = {};
  allowed.forEach((key) => {
    const val = file[key];
    if (val === null || val === undefined) return;
    cleaned[key] = val;
  });
  return cleaned;
}

function toNumber(val) {
  if (val === null || val === undefined || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : undefined;
}

function sanitizeFileNamePart(part) {
  if (!part) return '';
  return String(part)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatOrderDateForFile(timestamp) {
  if (!timestamp) return 'unknown-date';
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return 'unknown-date';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
}

function buildInvoiceFileName({ userName, vendor, orderDate, invoiceNumber, originalName }) {
  const parts = [
    sanitizeFileNamePart(userName) || 'User',
    sanitizeFileNamePart(vendor) || 'Vendor',
    formatOrderDateForFile(orderDate),
    invoiceNumber !== undefined && invoiceNumber !== null ? String(invoiceNumber) : ''
  ].filter(Boolean);
  const base = parts.join(' - ') || (originalName ? sanitizeFileNamePart(originalName) : 'invoice');
  const extMatch = typeof originalName === 'string' ? originalName.match(/(\.[^.]+)$/) : null;
  const ext = extMatch ? extMatch[1] : '';
  return `${base}${ext}`;
}

function sortReimbursementTags(tags = []) {
  return (Array.isArray(tags) ? [...tags] : [])
    .map((t, idx) => ({ ...t, sort: t.sortOrder ?? idx }))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

function mergeReimbursementStatuses(tags = []) {
  return [baseReimbursementStatus, ...sortReimbursementTags(tags)];
}

function isValidReimbursementStatus(value, tags = []) {
  if (!value) return false;
  const all = mergeReimbursementStatuses(tags);
  return all.some((s) => s.value === value || s.label === value);
}

async function loadReimbursementTagsSafe() {
  try {
    const statuses = await client.query('reimbursementTags:list', {});
    return Array.isArray(statuses) ? statuses : [];
  } catch (err) {
    logger.warn(err, 'Failed to load reimbursement tags');
    return [];
  }
}

function pickDefaultReimbursementStatus(tags = [], { requested }) {
  const all = mergeReimbursementStatuses(tags);
  if (!all.length) return null;
  if (!requested) return baseReimbursementStatus.value;
  const nonBase = all.filter((s) => s.value !== baseReimbursementStatus.value);
  const pick = nonBase[0] || baseReimbursementStatus;
  return pick?.value || pick?.label || null;
}

function parseServiceAccountJson(raw) {
  if (!raw) return null;
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const clientEmail = obj.client_email || obj.clientEmail;
  const privateKey = normalizePrivateKey(obj.private_key || obj.privateKey);
  const projectId = obj.project_id || obj.projectId;
  if (!clientEmail || !privateKey) {
    throw new Error('Invalid service account JSON: missing client_email or private_key');
  }
  return { clientEmail, privateKey, projectId, rawJson: JSON.stringify(obj) };
}

function normalizeInvoice(inv) {
  if (!inv) return inv;
  const norm = { ...inv };
  ['_id', 'orderId', 'groupId', 'requestedBy', 'reimbursementUser'].forEach(key => {
    if (norm[key] && norm[key].toString) {
      norm[key] = norm[key].toString();
    }
  });
  return norm;
}

function sanitizeGoogleConfig(record) {
  if (!record) return null;
  const safe = {
    projectId: record.projectId,
    clientEmail: record.clientEmail,
    folderId: record.folderId,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
    hasPrivateKey: Boolean(record.privateKey)
  };
  return safe;
}

function isOwnOrder(order, user) {
  if (!order || !user?.name) return false;
  return (order.studentName || '').toLowerCase() === user.name.toLowerCase();
}

async function getSessionUser(token) {
  if (!token) return null;
  const session = await client.query('auth:getSession', { token });
  if (!session) return null;
  const policy = await client.query('roles:get', { role: session.user.role || 'student' });
  const effectivePermissions = {
    ...defaultPermissions(session.user.role),
    ...(policy?.permissions || {}),
    ...(session.user.permissions || {})
  };
  // Ensure admins always have every permission, including newly added ones.
  if ((session.user.role || '').toLowerCase() === 'admin') {
    Object.assign(effectivePermissions, defaultPermissions('admin'));
  }
  if (effectivePermissions.canManageInvoices) {
    effectivePermissions.canViewInvoices = true;
  }
  return {
    sessionId: session.sessionId,
    ...session.user,
    permissions: effectivePermissions
  };
}

async function requireAuth(req, res, permission) {
  const token = req.cookies[config.sessionCookie] || req.headers['x-session-token'];
  const user = await getSessionUser(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (permission && !user.permissions?.[permission]) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  req.user = user;
  req.sessionToken = token;
  return user;
}

const AUDIT_REDACT_KEYS = new Set([
  'password',
  'passwordHash',
  'oldPassword',
  'newPassword',
  'credentialsJson',
  'serviceAccount',
  'privateKey',
  'token'
]);
const AUDIT_MAX_STRING = 400;
const AUDIT_MAX_ARRAY = 20;
const AUDIT_MAX_DEPTH = 2;

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || undefined;
}

function sanitizeAuditValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > AUDIT_MAX_STRING) return `${value.slice(0, AUDIT_MAX_STRING)}...`;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[buffer ${value.length}]`;
  if (Array.isArray(value)) {
    return value.slice(0, AUDIT_MAX_ARRAY).map(item => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= AUDIT_MAX_DEPTH) return '[object]';
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      if (AUDIT_REDACT_KEYS.has(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = sanitizeAuditValue(val, depth + 1);
      }
    });
    return out;
  }
  return String(value);
}

function buildAuditMetadata(req) {
  const metadata = {};
  if (req.params && Object.keys(req.params).length) {
    metadata.params = sanitizeAuditValue(req.params);
  }
  if (req.query && Object.keys(req.query).length) {
    metadata.query = sanitizeAuditValue(req.query);
  }
  if (req.body && Object.keys(req.body).length) {
    metadata.body = sanitizeAuditValue(req.body);
  }
  if (req.files && Array.isArray(req.files) && req.files.length) {
    metadata.files = {
      count: req.files.length,
      names: req.files.slice(0, 5).map(file => file.originalname)
    };
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

const AUDIT_ROUTE_MAP = [
  { method: 'POST', regex: /^\/api\/auth\/login$/, action: ({ statusCode }) => (statusCode < 400 ? 'auth.login' : 'auth.login_failed') },
  { method: 'POST', regex: /^\/api\/auth\/logout$/, action: 'auth.logout' },
  { method: 'PATCH', regex: /^\/api\/auth\/password$/, action: 'auth.password_change' },
  { method: 'POST', regex: /^\/api\/users$/, action: 'users.create', entityType: 'user', labelFrom: req => req.body?.username || req.body?.name },
  { method: 'PATCH', regex: /^\/api\/users\/.+$/, action: 'users.update', entityType: 'user', entityIdParam: 'id', labelFrom: req => req.body?.username || req.body?.name },
  { method: 'DELETE', regex: /^\/api\/users\/.+$/, action: 'users.delete', entityType: 'user', entityIdParam: 'id' },
  { method: 'PATCH', regex: /^\/api\/roles\/.+$/, action: 'roles.update', entityType: 'role', entityIdParam: 'role' },
  { method: 'POST', regex: /^\/api\/catalog\/categories$/, action: 'catalog.category.create', entityType: 'catalogCategory', labelFrom: req => req.body?.name },
  { method: 'PATCH', regex: /^\/api\/catalog\/categories\/.+$/, action: 'catalog.category.update', entityType: 'catalogCategory', entityIdParam: 'id', labelFrom: req => req.body?.name },
  { method: 'DELETE', regex: /^\/api\/catalog\/categories\/.+$/, action: 'catalog.category.delete', entityType: 'catalogCategory', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/catalog\/items$/, action: 'catalog.item.create', entityType: 'catalogItem', labelFrom: req => req.body?.name },
  { method: 'PATCH', regex: /^\/api\/catalog\/items\/.+$/, action: 'catalog.item.update', entityType: 'catalogItem', entityIdParam: 'id', labelFrom: req => req.body?.name },
  { method: 'DELETE', regex: /^\/api\/catalog\/items\/.+$/, action: 'catalog.item.delete', entityType: 'catalogItem', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/stock\/subteams$/, action: 'stock.subteam.create', entityType: 'stockSubteam', labelFrom: req => req.body?.name },
  { method: 'PATCH', regex: /^\/api\/stock\/subteams\/.+$/, action: 'stock.subteam.update', entityType: 'stockSubteam', entityIdParam: 'id', labelFrom: req => req.body?.name },
  { method: 'DELETE', regex: /^\/api\/stock\/subteams\/.+$/, action: 'stock.subteam.delete', entityType: 'stockSubteam', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/stock$/, action: 'stock.item.create', entityType: 'stockItem', labelFrom: req => req.body?.name },
  { method: 'PATCH', regex: /^\/api\/stock\/.+$/, action: 'stock.item.update', entityType: 'stockItem', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/stock\/[^/]+\/adjust$/, action: 'stock.item.adjust', entityType: 'stockItem', entityIdParam: 'id' },
  { method: 'DELETE', regex: /^\/api\/stock\/.+$/, action: 'stock.item.delete', entityType: 'stockItem', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/orders$/, action: 'orders.create', entityType: 'order', labelFrom: req => req.body?.partName || req.body?.orderNumber },
  { method: 'PATCH', regex: /^\/api\/orders\/[^/]+\/status$/, action: 'orders.status', entityType: 'order', entityIdParam: 'id' },
  { method: 'PATCH', regex: /^\/api\/orders\/[^/]+\/approval$/, action: 'orders.approval', entityType: 'order', entityIdParam: 'id' },
  { method: 'PATCH', regex: /^\/api\/orders\/[^/]+\/group$/, action: 'orders.group', entityType: 'order', entityIdParam: 'id' },
  { method: 'PATCH', regex: /^\/api\/orders\/.+$/, action: 'orders.update', entityType: 'order', entityIdParam: 'id' },
  { method: 'DELETE', regex: /^\/api\/orders\/.+$/, action: 'orders.delete', entityType: 'order', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/order-groups$/, action: 'orderGroups.create', entityType: 'orderGroup', labelFrom: req => req.body?.title },
  { method: 'PATCH', regex: /^\/api\/order-groups\/.+$/, action: 'orderGroups.update', entityType: 'orderGroup', entityIdParam: 'id' },
  { method: 'DELETE', regex: /^\/api\/order-groups\/.+$/, action: 'orderGroups.delete', entityType: 'orderGroup', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/invoices$/, action: 'invoices.create', entityType: 'invoice' },
  { method: 'PATCH', regex: /^\/api\/invoices\/.+$/, action: 'invoices.update', entityType: 'invoice', entityIdParam: 'id' },
  { method: 'DELETE', regex: /^\/api\/invoices\/.+$/, action: 'invoices.delete', entityType: 'invoice', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/invoices\/restore$/, action: 'invoices.restore', entityType: 'invoice' },
  { method: 'POST', regex: /^\/api\/invoices\/preview$/, action: 'invoices.preview', entityType: 'invoice' },
  { method: 'POST', regex: /^\/api\/tags$/, action: 'tags.create', entityType: 'tag', labelFrom: req => req.body?.label },
  { method: 'PATCH', regex: /^\/api\/tags\/.+$/, action: 'tags.update', entityType: 'tag', entityIdParam: 'id', labelFrom: req => req.body?.label },
  { method: 'DELETE', regex: /^\/api\/tags\/.+$/, action: 'tags.delete', entityType: 'tag', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/reimbursement-tags$/, action: 'reimbursementTags.create', entityType: 'reimbursementTag', labelFrom: req => req.body?.label },
  { method: 'PATCH', regex: /^\/api\/reimbursement-tags\/.+$/, action: 'reimbursementTags.update', entityType: 'reimbursementTag', entityIdParam: 'id', labelFrom: req => req.body?.label },
  { method: 'DELETE', regex: /^\/api\/reimbursement-tags\/.+$/, action: 'reimbursementTags.delete', entityType: 'reimbursementTag', entityIdParam: 'id' },
  { method: 'POST', regex: /^\/api\/vendors\/configs$/, action: 'vendors.config.create', entityType: 'vendorConfig', labelFrom: req => req.body?.vendor },
  { method: 'PATCH', regex: /^\/api\/vendors\/configs\/.+$/, action: 'vendors.config.update', entityType: 'vendorConfig', entityIdParam: 'id' },
  { method: 'DELETE', regex: /^\/api\/vendors\/configs\/.+$/, action: 'vendors.config.delete', entityType: 'vendorConfig', entityIdParam: 'id' },
  { method: 'PATCH', regex: /^\/api\/vendors\/integrations\/.+$/, action: 'vendors.integration.update', entityType: 'vendorIntegration', entityIdParam: 'key' },
  { method: 'POST', regex: /^\/api\/vendors\/resolve$/, action: 'vendors.resolve' },
  { method: 'POST', regex: /^\/api\/vendors\/shareacart$/, action: 'vendors.shareacart' },
  { method: 'POST', regex: /^\/api\/vendors\/extract$/, action: 'vendors.extract' },
  { method: 'PATCH', regex: /^\/api\/tracking\/settings$/, action: 'tracking.settings.update', entityType: 'trackingSettings' },
  { method: 'POST', regex: /^\/api\/tracking\/refresh$/, action: 'tracking.refresh', entityType: 'trackingSettings' },
  { method: 'POST', regex: /^\/api\/google\/credentials$/, action: 'google.credentials.update', entityType: 'googleCredentials' }
];

function resolveAuditDescriptor(req, statusCode) {
  const method = req.method.toUpperCase();
  const path = req.path;
  for (const route of AUDIT_ROUTE_MAP) {
    if (route.method && route.method !== method) continue;
    if (!route.regex.test(path)) continue;
    const action = typeof route.action === 'function'
      ? route.action({ statusCode, req })
      : route.action;
    const entityId = route.entityIdParam ? req.params?.[route.entityIdParam] : undefined;
    const entityLabel = route.labelFrom ? route.labelFrom(req) : undefined;
    return { action, entityType: route.entityType, entityId, entityLabel };
  }
  return { action: `api.${method.toLowerCase()}`, entityType: undefined };
}

function buildAuditUser(req) {
  const user = req.auditUser || req.user;
  if (user) {
    return {
      userId: user._id?.toString?.() || user._id,
      userName: user.name || user.username || user.userName,
      userRole: user.role
    };
  }
  if (req.body?.username) {
    return { userName: String(req.body.username) };
  }
  return {};
}

function queueAuditLog(entry) {
  if (!entry || !entry.action) return;
  client.mutation('audit:log', entry).catch(err => {
    logger.warn(err, 'Failed to record audit log');
  });
}

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/api/audit')) return next();
  if (req.method.toUpperCase() === 'GET') return next();
  res.on('finish', () => {
    const descriptor = resolveAuditDescriptor(req, res.statusCode);
    const auditUser = buildAuditUser(req);
    queueAuditLog({
      action: descriptor.action,
      entityType: descriptor.entityType,
      entityId: descriptor.entityId,
      entityLabel: descriptor.entityLabel,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: getRequestIp(req),
      userAgent: req.headers['user-agent'],
      metadata: buildAuditMetadata(req),
      ...auditUser
    });
  });
  next();
});

function setSessionCookie(res, token) {
  const maxAge = config.sessionDays * 24 * 60 * 60 * 1000;
  res.cookie(config.sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge
  });
}

function normalizeTrackingPayload(trackingInput, legacyNumber, legacyCarrier) {
  const arr = Array.isArray(trackingInput) ? trackingInput : [];
  const base = arr.length
    ? arr
    : (legacyNumber ? [{ carrier: legacyCarrier || 'unknown', trackingNumber: legacyNumber }] : []);
  return base
    .map(entry => {
      const num = entry.trackingNumber || entry.number || legacyNumber;
      if (!num) return null;
      const carrier = (entry.carrier || legacyCarrier || 'unknown').toLowerCase();
      return {
        carrier,
        trackingNumber: num,
        trackingUrl: entry.trackingUrl || buildTrackingUrl(carrier, num)
      };
    })
    .filter(Boolean);
}

async function ensureAdminSeed() {
  try {
    const users = await client.query('auth:listUsers', {});
    // Backfill usernames if missing
    for (const u of users) {
      if (!u.username) {
        const fallback = (u.email || 'user').split('@')[0] || 'user';
        const desired = fallback || 'user';
        try {
          await client.mutation('auth:updateUser', { id: u._id, username: desired });
          logger.info(`Backfilled username for user ${u._id} -> ${desired}`);
        } catch (e) {
          logger.error(e, `Failed to backfill username for ${u._id}`);
        }
      }
    }
    if (!users || users.length === 0) {
      const hash = await bcrypt.hash('password', 10);
      await client.mutation('auth:createUser', {
        username: 'admin',
        name: 'Admin',
        role: 'admin',
        active: true,
        permissions: defaultPermissions('admin'),
        passwordHash: hash
      });
      logger.info('Seeded default admin account: admin / password');
    }
  } catch (error) {
    logger.error(error, 'Failed to seed default admin');
  }
}

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), convexUrl: config.convexUrl });
});

app.get('/api/users', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  try {
    const users = await client.query('auth:listUsers', {});
    res.json({ users });
  } catch (error) {
    logger.error(error, 'Failed to list users');
    res.status(500).json({ error: 'Unable to list users' });
  }
});

app.post('/api/users', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  const { username, name, role, permissions, password, active = true } = req.body || {};
  if (!username || !name || !role || !password) {
    return res.status(400).json({ error: 'username, name, role, password required' });
  }
  try {
    const perms = permissions || {};
    const hash = await bcrypt.hash(password, 10);
    const result = await client.mutation('auth:createUser', {
      username: username.toLowerCase(),
      name,
      role,
      active,
      permissions: perms,
      passwordHash: hash
    });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create user');
    res.status(500).json({ error: 'Unable to create user' });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  const { name, role, permissions, active, password } = req.body || {};
  try {
    const updatesBase = {
      id: req.params.id,
      name,
      role,
      permissions,
      active
    };
    // If role provided and permissions not provided, reset to defaults for that role
    if (role && permissions === undefined) {
      updatesBase.permissions = {};
    }
    const updates = {
      ...updatesBase
    };
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    await client.mutation('auth:updateUser', updates);
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to update user');
    res.status(500).json({ error: 'Unable to update user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  try {
    const result = await client.mutation('auth:deleteUser', { id: req.params.id });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete user');
    res.status(500).json({ error: 'Unable to delete user' });
  }
});

app.get('/api/roles', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  try {
    const roles = await client.query('roles:list', {});
    res.json({ roles });
  } catch (error) {
    logger.error(error, 'Failed to list roles');
    res.status(500).json({ error: 'Unable to list roles' });
  }
});

app.patch('/api/roles/:role', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  const { permissions } = req.body || {};
  if (!permissions) return res.status(400).json({ error: 'permissions required' });
  try {
    await client.mutation('roles:upsert', { role: req.params.role, permissions });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to update role');
    res.status(500).json({ error: 'Unable to update role' });
  }
});

app.get('/api/audit', async (req, res) => {
  const user = await requireAuth(req, res, 'canViewAuditLog');
  if (!user) return;
  const parseNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  };
  const limit = parseNumber(req.query.limit);
  const before = parseNumber(req.query.before);
  const after = parseNumber(req.query.after);
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  try {
    const data = await client.query('audit:list', {
      limit,
      before,
      after,
      action,
      entityType,
      entityId,
      userId,
      search
    });
    res.json(data);
  } catch (error) {
    logger.error(error, 'Failed to load audit logs');
    res.status(500).json({ error: 'Unable to load audit logs' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const user = await client.query('auth:getUserByUsername', { username: username.toLowerCase() });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + config.sessionDays * 24 * 60 * 60 * 1000;
    await client.mutation('auth:createSession', {
      userId: user._id,
      token,
      expiresAt
    });

    setSessionCookie(res, token);
    req.auditUser = {
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role
    };
    // Return effective permissions (role policy + defaults)
    const sessionUser = await getSessionUser(token);
    res.json({ user: sessionUser });
  } catch (error) {
    logger.error(error, 'Failed login');
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies[config.sessionCookie] || req.headers['x-session-token'];
  if (token) {
    try {
      const sessionUser = await getSessionUser(token);
      if (sessionUser) {
        req.auditUser = sessionUser;
      }
    } catch (e) {
      logger.warn(e, 'Unable to resolve session user for logout');
    }
  }
  if (token) {
    try {
      await client.mutation('auth:deleteSession', { token });
    } catch (e) {
      logger.error(e, 'Failed to delete session on logout');
    }
  }
  res.clearCookie(config.sessionCookie);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies[config.sessionCookie] || req.headers['x-session-token'];
  const user = await getSessionUser(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  queueAuditLog({
    action: 'app.visit',
    method: req.method,
    path: req.path,
    status: 200,
    ip: getRequestIp(req),
    userAgent: req.headers['user-agent'],
    userId: user._id?.toString?.() || user._id,
    userName: user.name || user.username,
    userRole: user.role
  });
  res.json({ user });
});

app.patch('/api/auth/password', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
  try {
    const dbUser = await client.query('auth:getUserByUsername', { username: user.username });
    const ok = await bcrypt.compare(oldPassword, dbUser.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const hash = await bcrypt.hash(newPassword, 10);
    await client.mutation('auth:updateUser', { id: dbUser._id, passwordHash: hash });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to change password');
    res.status(500).json({ error: 'Unable to change password' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const data = await client.query('parts:categories', {});
    res.json(data);
  } catch (error) {
    logger.error(error, 'Failed to load categories');
    res.status(500).json({ error: 'Unable to load categories' });
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const items = await client.query('parts:list', {
      category: req.query.category || undefined,
      subcategory: req.query.subcategory || undefined,
      type: req.query.type || undefined,
      search: req.query.search || undefined
    });
    res.json({ items });
  } catch (error) {
    logger.error(error, 'Failed to load inventory');
    res.status(500).json({ error: 'Unable to load inventory' });
  }
});

// Catalog (saved parts) APIs
app.get('/api/catalog/categories', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const data = await client.query('catalog:listCategories', {});
    res.json(data);
  } catch (error) {
    logger.error(error, 'Failed to load catalog categories');
    res.status(500).json({ error: 'Unable to load catalog categories' });
  }
});

app.post('/api/catalog/categories', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditInventoryCatalog');
  if (!user) return;
  const { name, parentId, sortOrder } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await client.mutation('catalog:createCategory', {
      name,
      parentId,
      sortOrder: sortOrder === undefined ? undefined : Number(sortOrder),
      userId: user._id?.toString()
    });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create catalog category');
    res.status(500).json({ error: 'Unable to create catalog category', details: error.message });
  }
});

app.patch('/api/catalog/categories/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditInventoryCatalog');
  if (!user) return;
  try {
    const result = await client.mutation('catalog:updateCategory', {
      id: req.params.id,
      name: req.body?.name,
      parentId: req.body?.parentId,
      sortOrder: req.body?.sortOrder === undefined ? undefined : Number(req.body.sortOrder)
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to update catalog category');
    res.status(500).json({ error: 'Unable to update catalog category', details: error.message });
  }
});

app.delete('/api/catalog/categories/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditInventoryCatalog');
  if (!user) return;
  try {
    const result = await client.mutation('catalog:deleteCategory', {
      id: req.params.id,
      cascade: req.body?.cascade ?? req.query.cascade === 'true',
      reassignTo: req.body?.reassignTo || req.query.reassignTo
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete catalog category');
    res.status(500).json({ error: 'Unable to delete catalog category', details: error.message });
  }
});

app.get('/api/catalog/items', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const data = await client.query('catalog:listItems', {
      search: req.query.search || undefined,
      categoryId: req.query.categoryId || undefined,
      includeDescendants: req.query.includeDescendants === undefined ? false : req.query.includeDescendants !== 'false',
      subteam: req.query.subteam || undefined,
      type: req.query.type || undefined,
      includeArchived: req.query.includeArchived === 'true'
    });
    res.json(data);
  } catch (error) {
    logger.error(error, 'Failed to load catalog items');
    res.status(500).json({ error: 'Unable to load catalog items' });
  }
});

function normalizeCategoryPath(path) {
  if (!path) return undefined;
  if (Array.isArray(path)) return path.map(p => String(p || '').trim()).filter(Boolean);
  if (typeof path === 'string') return path.split('/').map(p => p.trim()).filter(Boolean);
  return undefined;
}

function normalizeVariationsInput(list) {
  if (!Array.isArray(list)) return undefined;
  return list.map(v => ({
    ...v,
    unitCost: v.unitCost !== undefined ? Number(v.unitCost) : v.unitCost
  }));
}

app.post('/api/catalog/items', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditInventoryCatalog');
  if (!user) return;
  const payload = req.body || {};
  if (!payload.name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await client.mutation('catalog:createItem', {
      ...payload,
      unitCost: payload.unitCost !== undefined ? Number(payload.unitCost) : undefined,
      defaultQuantity: payload.defaultQuantity !== undefined ? Number(payload.defaultQuantity) : undefined,
      categoryPath: normalizeCategoryPath(payload.categoryPath),
      variations: normalizeVariationsInput(payload.variations),
      userId: user._id?.toString()
    });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create catalog item');
    res.status(500).json({ error: 'Unable to create catalog item', details: error.message });
  }
});

app.patch('/api/catalog/items/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditInventoryCatalog');
  if (!user) return;
  const payload = req.body || {};
  try {
    const result = await client.mutation('catalog:updateItem', {
      ...payload,
      id: req.params.id,
      unitCost: payload.unitCost !== undefined ? Number(payload.unitCost) : payload.unitCost,
      defaultQuantity: payload.defaultQuantity !== undefined ? Number(payload.defaultQuantity) : payload.defaultQuantity,
      categoryPath: normalizeCategoryPath(payload.categoryPath),
      variations: normalizeVariationsInput(payload.variations),
      userId: user._id?.toString()
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to update catalog item');
    res.status(500).json({ error: 'Unable to update catalog item', details: error.message });
  }
});

app.delete('/api/catalog/items/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditInventoryCatalog');
  if (!user) return;
  try {
    const result = await client.mutation('catalog:deleteItem', {
      id: req.params.id,
      hard: req.query.hard === 'true' || req.body?.hard === true
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete catalog item');
    res.status(500).json({ error: 'Unable to delete catalog item', details: error.message });
  }
});

app.get('/api/stock/subteams', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const data = await client.query('stock:listSubteams', {});
    res.json(data);
  } catch (error) {
    logger.error(error, 'Failed to list stock subteams');
    res.status(500).json({ error: 'Unable to list stock subteams' });
  }
});

app.post('/api/stock/subteams', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageStock');
  if (!user) return;
  try {
    const result = await client.mutation('stock:upsertSubteam', {
      name: req.body?.name,
      description: req.body?.description,
      userId: user._id?.toString()
    });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create subteam');
    res.status(500).json({ error: 'Unable to create subteam', details: error.message });
  }
});

app.patch('/api/stock/subteams/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageStock');
  if (!user) return;
  try {
    const result = await client.mutation('stock:upsertSubteam', {
      id: req.params.id,
      name: req.body?.name,
      description: req.body?.description,
      userId: user._id?.toString()
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to update subteam');
    res.status(500).json({ error: 'Unable to update subteam', details: error.message });
  }
});

app.delete('/api/stock/subteams/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageStock');
  if (!user) return;
  try {
    const result = await client.mutation('stock:deleteSubteam', {
      id: req.params.id,
      userId: user._id?.toString()
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete subteam');
    res.status(500).json({ error: 'Unable to delete subteam', details: error.message });
  }
});

app.get('/api/stock', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const data = await client.query('stock:list', {
      subteamId: req.query.subteamId || undefined,
      search: req.query.search || undefined,
      includeArchived: req.query.includeArchived === 'true',
      catalogItemId: req.query.catalogItemId || undefined
    });
    res.json(data);
  } catch (error) {
    logger.error(error, 'Failed to load stock');
    res.status(500).json({ error: 'Unable to load stock' });
  }
});

app.post('/api/stock', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageStock');
  if (!user) return;
  const {
    catalogItemId,
    subteamId,
    quantityOnHand,
    usedQuantity,
    trackUsedStock,
    lowStockThreshold,
    location,
    category,
    notes
  } = req.body || {};
  if (!catalogItemId || quantityOnHand === undefined) {
    return res.status(400).json({ error: 'catalogItemId and quantityOnHand are required' });
  }
  try {
    const result = await client.mutation('stock:create', {
      catalogItemId,
      subteamId,
      quantityOnHand,
      usedQuantity,
      trackUsedStock,
      lowStockThreshold,
      location,
      category,
      notes,
      userId: user._id?.toString()
    });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create stock item');
    const message = error?.message || '';
    if (message.includes('Item already exists in location')) {
      return res.status(400).json({ error: 'Item already exists in location' });
    }
    res.status(500).json({ error: 'Unable to create stock item', details: error.message });
  }
});

app.patch('/api/stock/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageStock');
  if (!user) return;
  const { subteamId, lowStockThreshold, location, category, notes, quantityOnHand, usedQuantity, trackUsedStock } = req.body || {};
  try {
    const result = await client.mutation('stock:update', {
      id: req.params.id,
      subteamId,
      lowStockThreshold,
      location,
      category,
      notes,
      quantityOnHand,
      usedQuantity,
      trackUsedStock,
      userId: user._id?.toString()
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to update stock item');
    res.status(500).json({ error: 'Unable to update stock item', details: error.message });
  }
});

app.post('/api/stock/:id/adjust', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  if (!user.permissions?.canEditStock && !user.permissions?.canManageStock) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { delta, quantityOnHand, usedDelta, usedQuantity } = req.body || {};
  try {
    const result = await client.mutation('stock:adjustQuantity', {
      id: req.params.id,
      delta,
      quantityOnHand,
      usedDelta,
      usedQuantity,
      userId: user._id?.toString()
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to adjust stock quantity');
    res.status(500).json({ error: 'Unable to adjust stock quantity', details: error.message });
  }
});

app.delete('/api/stock/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageStock');
  if (!user) return;
  try {
    const result = await client.mutation('stock:remove', {
      id: req.params.id,
      hard: req.query.hard === 'true'
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete stock item');
    res.status(500).json({ error: 'Unable to delete stock item', details: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const data = await client.query('orders:list', {
      status: req.query.status || undefined
    });
    const orderIds = (data.orders || []).map(o => (o._id && o._id.toString) ? o._id.toString() : (o._id || o.id || o.orderId)).filter(Boolean);
    let invoiceMap = new Map();
    const canViewInvoices = Boolean(user.permissions?.canViewInvoices || user.permissions?.canManageInvoices);
    if (orderIds.length) {
      const invoiceListRaw = await client.query('invoices:listForOrders', { orderIds });
      const filteredForGrouping = invoiceListRaw.filter(inv => inv.groupId || inv.group || inv.groupId === null);
      const filteredInvoices = canViewInvoices
        ? filteredForGrouping
        : (invoiceListRaw || []).filter(inv => {
            const requester = inv.requestedBy && inv.requestedBy.toString ? inv.requestedBy.toString() : inv.requestedBy;
            const studentName = (inv.studentName || '').toLowerCase();
            const userName = (user.name || '').toLowerCase();
            return requester === String(user._id || '') || studentName === userName;
          });
      const invoiceList = (filteredInvoices || []).map(normalizeInvoice);
      invoiceMap = new Map();
      (invoiceList || []).forEach(inv => {
        const key = inv.orderId && inv.orderId.toString ? inv.orderId.toString() : inv.orderId;
        if (!key) return;
        const list = invoiceMap.get(key) || [];
        list.push(inv);
        invoiceMap.set(key, list);
      });
    }
    const ordersWithInvoices = (data.orders || []).map(order => {
      const key = order._id && order._id.toString ? order._id.toString() : order._id || order.id || order.orderId;
      const invoices = key ? (invoiceMap.get(String(key)) || []) : [];
      const requested = invoices.filter(i => i.reimbursementRequested);
      const latest = requested[0] || invoices[0] || null;
      const statuses = Array.from(new Set(requested.map(i => i.reimbursementStatus).filter(Boolean)));
      const checkedAtRaw = Number(order.wcpStockCheckedAt);
      const persistedWcpStock =
        order.wcpStockStatus ||
        order.wcpStockLabel ||
        Number.isFinite(Number(order.wcpInStockQty)) ||
        (order.wcpVariantId !== undefined && order.wcpVariantId !== null)
          ? {
              status: order.wcpStockStatus || "unknown",
              label: order.wcpStockLabel || null,
              inStockQty: Number.isFinite(Number(order.wcpInStockQty))
                ? Math.max(0, Math.round(Number(order.wcpInStockQty)))
                : null,
              variantId:
                order.wcpVariantId !== undefined && order.wcpVariantId !== null
                  ? String(order.wcpVariantId)
                  : null,
              statusSource: order.wcpStockStatusSource || null,
              quantitySource: order.wcpStockQuantitySource || null,
              checkedAt: Number.isFinite(checkedAtRaw) ? checkedAtRaw : null,
              error: order.wcpStockError || null
            }
          : null;
      return {
        ...order,
        wcpStock: persistedWcpStock || order.wcpStock || undefined,
        invoices,
        reimbursementSummary: {
          count: invoices.length,
          requestedCount: requested.length,
          statuses,
          latestStatus: latest?.reimbursementStatus || null
        }
      };
    });
    const withStock = stockStatusService.applySnapshotsToOrders(ordersWithInvoices);
    res.json({ ...data, orders: withStock });
  } catch (error) {
    logger.error(error, 'Failed to load orders');
    res.status(500).json({ error: 'Unable to load orders' });
  }
});

app.get('/api/invoices', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const canManage = Boolean(user.permissions?.canManageInvoices);
  const canViewAll = Boolean(user.permissions?.canManageInvoices || user.permissions?.canViewInvoices);
  const args = {
    orderId: req.query.orderId || undefined,
    groupId: req.query.groupId || undefined,
    status: req.query.status || undefined,
    reimbursementOnly: req.query.reimbursementOnly === 'true',
    requestedBy: req.query.requestedBy || undefined
  };
  if (!canViewAll) {
    args.requestedBy = user._id?.toString();
  }
  try {
    let invoices = (await client.query('invoices:list', args) || []).map(normalizeInvoice);
    const missingVendorOrderIds = Array.from(
      new Set(
        invoices
          .filter((inv) => !inv.vendor && inv.orderId)
          .map((inv) => inv.orderId),
      ),
    );
    const orderVendorMap = new Map();
    for (const oid of missingVendorOrderIds) {
      try {
        const order = await client.query('orders:getOne', { orderId: oid });
        if (order) {
          orderVendorMap.set(
            oid,
            order.supplier || order.vendor || order.group?.supplier || order.group?.title,
          );
        }
      } catch (e) {
        logger.warn(e, 'Failed to fetch order for vendor fill');
      }
    }
    invoices = invoices.map((inv) =>
      inv.vendor
        ? inv
        : {
            ...inv,
            vendor: orderVendorMap.get(inv.orderId) || inv.vendor || null,
          },
    );
    if (canManage) {
      const needNames = Array.from(
        new Set(
          invoices
            .filter((i) => i.reimbursementUser && !i.reimbursementUserName)
            .map((i) => i.reimbursementUser),
        ),
      );
      if (needNames.length) {
        const users = await client.query('auth:listUsers', {});
        const lookup = new Map(
          (users || []).map((u) => [
            u._id?.toString?.() || u._id,
            u.name || u.username || '',
          ]),
        );
        invoices = invoices.map((inv) =>
          inv.reimbursementUser && !inv.reimbursementUserName
            ? {
                ...inv,
                reimbursementUserName:
                  lookup.get(inv.reimbursementUser) || inv.reimbursementUserName,
              }
            : inv,
        );
      }
    }
    if (!canViewAll) {
      const name = (user.name || '').toLowerCase();
      invoices = invoices.filter(inv => {
        const requester = inv.requestedBy ? String(inv.requestedBy) : '';
        return requester === String(user._id || '') || (inv.studentName || '').toLowerCase() === name;
      });
    }
    res.json({ invoices });
  } catch (error) {
    logger.error(error, 'Failed to list invoices');
    res.status(500).json({ error: 'Unable to list invoices' });
  }
});

app.get('/api/invoices/:id/file/:fileId', async (req, res) => {
  const user = await requireAuth(req, res, 'canSubmitInvoices');
  if (!user) return;
  const invoiceId = req.params.id;
  const fileId = req.params.fileId;
  try {
    const invoice = await client.query('invoices:get', { invoiceId });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const isOwner =
      invoice.requestedBy &&
      user._id &&
      invoice.requestedBy.toString() === user._id.toString();
    const canView =
      user.permissions?.canManageInvoices ||
      user.permissions?.canViewInvoices ||
      isOwner;
    if (!canView) return res.status(403).json({ error: 'Forbidden' });
    const download = await invoiceService.downloadFromDrive(fileId);
    if (!download) return res.status(404).json({ error: 'File not available' });
    res.setHeader(
      'Content-Type',
      download.mimeType || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(download.name || 'invoice')}"`
    );
    download.stream.pipe(res);
  } catch (error) {
    logger.error(error, 'Failed to stream invoice file');
    res.status(500).json({ error: 'Unable to load file' });
  }
});

app.post('/api/invoices', upload.array('files', 8), async (req, res) => {
  const user = await requireAuth(req, res, 'canSubmitInvoices');
  if (!user) return;
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId is required' });
  try {
    const order = await client.query('orders:getOne', { orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.groupId && !(order.group && order.group._id)) {
      return res.status(400).json({ error: 'Invoices can only be added to grouped orders' });
    }
    const ownsOrder = isOwnOrder(order, user);
    const canManage = Boolean(user.permissions?.canManageInvoices || user.permissions?.canManageOrders);
    if (!ownsOrder && !canManage) {
      return res.status(403).json({ error: 'You can only submit invoices for your own requests' });
    }
    const vendorName = order.supplier || order.vendor || order.group?.supplier;
    const submitterName = user.name || user.username || '';
    let invoiceNumber = 1;
    try {
      const existingInvoices = await client.query('invoices:list', { orderId });
      invoiceNumber = (existingInvoices?.length || 0) + 1;
    } catch (err) {
      logger.warn(err, 'Failed to count existing invoices for file naming');
    }
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ error: 'At least one invoice file is required' });
    }
    const processedFiles = [];
    for (const file of files) {
      const renamed = buildInvoiceFileName({
        userName: submitterName,
        vendor: vendorName,
        orderDate: order.requestedAt,
        invoiceNumber,
        originalName: file.originalname
      });
      processedFiles.push(await invoiceService.processFile(file, { name: renamed }));
    }
    const cleanedFiles = processedFiles.map(cleanInvoiceFile);
    const amount = toNumber(req.body?.amount);
    const reimbursementTags = await loadReimbursementTagsSafe();
    let reimbursementStatus = req.body?.reimbursementStatus || null;
    if (reimbursementStatus) {
      if (!isValidReimbursementStatus(reimbursementStatus, reimbursementTags)) {
        return res.status(400).json({ error: 'Choose a reimbursement status from Tags > Reimbursements.' });
      }
    } else {
      reimbursementStatus = pickDefaultReimbursementStatus(reimbursementTags, { requested: false });
    }
    if (!reimbursementStatus) {
      return res.status(400).json({ error: 'Add reimbursement statuses in Tags > Reimbursements before submitting invoices.' });
    }
    const reimbursementRequested = reimbursementStatus !== baseReimbursementStatus.value;
    const reimbursementUser = user._id?.toString();
    const reimbursementUserName = user.name;
    const reimbursementAmount = amount;
    const payload = {
      orderId,
      groupId: req.body?.groupId || order.groupId || order.group?._id,
      orderNumber: order.orderNumber,
      groupTitle: order.group?.title || order.group?.supplier,
      vendor: vendorName,
      studentName: order.studentName,
      requestedBy: user._id?.toString(),
      requestedByName: user.name,
      amount,
      reimbursementAmount,
      reimbursementUser,
      reimbursementUserName,
      reimbursementRequested,
      reimbursementStatus,
      notes: req.body?.notes,
      files: cleanedFiles
    };
    const result = await client.mutation('invoices:create', payload);
    const saved = await client.query('invoices:get', { invoiceId: result.invoiceId });
    const invoice = saved ? normalizeInvoice(saved) : normalizeInvoice({ ...payload, _id: result.invoiceId });
    res.status(201).json({ invoice });
  } catch (error) {
    logger.error(error, 'Failed to submit invoice');
    res.status(500).json({ error: 'Unable to submit invoice', details: error.message });
  }
});

app.post('/api/invoices/preview', upload.array('files', 8), async (req, res) => {
  // Auto-processing disabled: keep endpoint for compatibility.
  return res.status(410).json({ error: 'Auto-processing disabled. Enter totals manually.' });
});

app.patch('/api/invoices/:id', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const invoice = await client.query('invoices:get', { invoiceId: req.params.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const isOwner = invoice.requestedBy && String(invoice.requestedBy) === String(user._id || '');
    const canManage = Boolean(user.permissions?.canManageInvoices);
    const canSubmit = Boolean(user.permissions?.canSubmitInvoices);
    if (!canManage && !(isOwner && canSubmit)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const reimbursementTags = await loadReimbursementTagsSafe();
    const updates = {
      invoiceId: req.params.id,
      amount: toNumber(req.body?.amount),
      reimbursementAmount: toNumber(req.body?.reimbursementAmount),
      notes: req.body?.notes
    };
    if (updates.amount !== undefined) {
      updates.reimbursementAmount = updates.amount;
    }
    const incomingStatus = req.body?.reimbursementStatus;
    const incomingRequested = req.body?.reimbursementRequested;
    if (incomingStatus) {
      if (!isValidReimbursementStatus(incomingStatus, reimbursementTags)) {
        return res.status(400).json({ error: 'Choose a reimbursement status from Tags > Reimbursements.' });
      }
      updates.reimbursementStatus = incomingStatus;
      updates.reimbursementRequested = incomingStatus !== baseReimbursementStatus.value;
      updates.statusNote = req.body?.statusNote;
      updates.changedBy = user._id?.toString();
      updates.changedByName = user.name;
    } else if (incomingRequested !== undefined) {
      const requestedBool = parseBoolean(incomingRequested);
      const defaultStatus = pickDefaultReimbursementStatus(reimbursementTags, { requested: requestedBool });
      if (!defaultStatus) {
        return res.status(400).json({ error: 'Add reimbursement statuses in Tags > Reimbursements before updating invoices.' });
      }
      updates.reimbursementStatus = defaultStatus;
      updates.reimbursementRequested = defaultStatus !== baseReimbursementStatus.value;
      updates.statusNote = req.body?.statusNote;
      updates.changedBy = user._id?.toString();
      updates.changedByName = user.name;
    }
    await client.mutation('invoices:update', updates);
    const refreshed = await client.query('invoices:get', { invoiceId: req.params.id });
    res.json({ invoice: normalizeInvoice(refreshed) });
  } catch (error) {
    logger.error(error, 'Failed to update invoice');
    res.status(500).json({ error: 'Unable to update invoice' });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const invoice = await client.query('invoices:get', { invoiceId: req.params.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const isOwner = invoice.requestedBy && String(invoice.requestedBy) === String(user._id || '');
    const canManage = Boolean(user.permissions?.canManageInvoices);
    const canSubmit = Boolean(user.permissions?.canSubmitInvoices);
    if (!canManage && !(isOwner && canSubmit)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await client.mutation('invoices:remove', { invoiceId: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to delete invoice');
    res.status(500).json({ error: 'Unable to delete invoice' });
  }
});

app.post('/api/invoices/restore', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const body = req.body || {};
  try {
    const allowed = ['orderId','groupId','orderNumber','groupTitle','vendor','studentName','requestedBy','requestedByName','requestedAt','amount','reimbursementAmount','reimbursementRequested','reimbursementStatus','reimbursementUser','reimbursementUserName','detectedTotal','detectedCurrency','detectedDate','detectedMerchant','notes','files'];
    const payload = {};
    allowed.forEach(k => {
      if (body[k] !== undefined) payload[k] = body[k];
    });
    ['detectedTotal','detectedCurrency','detectedDate','detectedMerchant'].forEach(k => {
      if (payload[k] === null || payload[k] === undefined) delete payload[k];
    });
    if (Array.isArray(payload.files)) {
      payload.files = payload.files.map(cleanInvoiceFile);
    }
    if (!payload.orderId || !Array.isArray(payload.files) || !payload.files.length) {
      return res.status(400).json({ error: 'Missing orderId or files for restore' });
    }
    const order = await client.query('orders:getOne', { orderId: payload.orderId });
    if (!order || (!order.groupId && !(order.group && order.group._id))) {
      return res.status(400).json({ error: 'Invoices can only be restored onto grouped orders' });
    }
    payload.requestedBy = payload.requestedBy || user._id?.toString();
    payload.requestedByName = payload.requestedByName || user.name;
    payload.vendor =
      payload.vendor ||
      order.supplier ||
      order.vendor ||
      order.group?.supplier;
    payload.requestedAt = payload.requestedAt || Date.now();
    payload.reimbursementRequested =
      payload.reimbursementRequested === undefined
        ? false
        : parseBoolean(payload.reimbursementRequested);
    if (!payload.reimbursementStatus) {
      const tags = await loadReimbursementTagsSafe();
      const defaultStatus = pickDefaultReimbursementStatus(tags, { requested: payload.reimbursementRequested === true });
      if (!defaultStatus) {
        return res.status(400).json({ error: 'Add reimbursement statuses in Tags > Reimbursements before restoring invoices.' });
      }
      payload.reimbursementStatus = defaultStatus;
    }
    payload.reimbursementRequested = payload.reimbursementStatus !== baseReimbursementStatus.value;
    const result = await client.mutation('invoices:create', payload);
    const saved = await client.query('invoices:get', { invoiceId: result.invoiceId });
    res.status(201).json({ invoice: normalizeInvoice(saved) });
  } catch (error) {
    logger.error(error, 'Failed to restore invoice');
    res.status(500).json({ error: 'Unable to restore invoice' });
  }
});

app.get('/api/users/min', async (req, res) => {
  const user = await requireAuth(req, res, 'canSubmitInvoices');
  if (!user) return;
  try {
    const list = await client.query('auth:listUsers', {});
    const users = (list || []).map(u => ({
      _id: u._id?.toString?.() || u._id,
      name: u.name,
      username: u.username
    }));
    res.json({ users });
  } catch (error) {
    logger.error(error, 'Failed to list minimal users');
    res.status(500).json({ error: 'Unable to list users' });
  }
});

app.get('/api/google/credentials', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageGoogleCredentials');
  if (!user) return;
  try {
    const record = await client.query('googleCredentials:get', {});
    res.json({ credentials: sanitizeGoogleConfig(record) });
  } catch (error) {
    logger.error(error, 'Failed to load Google credentials');
    res.status(500).json({ error: 'Unable to load Google credentials' });
  }
});

app.post('/api/google/credentials', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageGoogleCredentials');
  if (!user) return;
  try {
    const { folderId, credentialsJson, serviceAccount } = req.body || {};
    let parsed = null;
    if (credentialsJson) {
      parsed = parseServiceAccountJson(credentialsJson);
    } else if (serviceAccount) {
      parsed = parseServiceAccountJson(serviceAccount);
    }
    if (!folderId && !parsed) {
      return res.status(400).json({ error: 'Provide a folderId and/or service account JSON' });
    }
    const payload = {
      folderId: folderId || undefined,
      projectId: parsed?.projectId,
      clientEmail: parsed?.clientEmail,
      privateKey: parsed?.privateKey,
      rawJson: parsed?.rawJson,
      updatedBy: user._id?.toString()
    };
    const result = await client.mutation('googleCredentials:save', payload);
    const saved = await client.query('googleCredentials:get', {});
    invoiceService.updateCredentials({
      folderId: saved?.folderId,
      clientEmail: saved?.clientEmail,
      privateKey: saved?.privateKey,
      projectId: saved?.projectId
    });
    res.json({ credentials: sanitizeGoogleConfig(saved), id: result?._id || result?.id });
  } catch (error) {
    logger.error(error, 'Failed to save Google credentials');
    res.status(500).json({ error: 'Unable to save Google credentials', details: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const user = await requireAuth(req, res, 'canPlacePartRequests');
  if (!user) return;
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Order payload is required' });
  }
  const notesRequired = !user.permissions?.notesNotRequired;
  const rawNotes = typeof req.body.notes === 'string' ? req.body.notes : '';
  const sanitizedNotes = typeof rawNotes === 'string'
    ? sanitizeVendorImportNotes(rawNotes.trim())
    : '';
  if (notesRequired && !sanitizedNotes) {
    return res.status(400).json({ error: 'Notes/justification are required for this part request.' });
  }
  if (typeof req.body.notes === 'string') {
    req.body.notes = sanitizedNotes || undefined;
  }

  try {
    const tracking = normalizeTrackingPayload(req.body.tracking, req.body.trackingNumber, req.body.carrier);
    const isPrivileged = ['admin','mentor'].includes((user.role || '').toLowerCase()) || user.permissions?.canManagePartRequests;
    const approvalStatus = isPrivileged ? 'approved' : 'pending';
    const payload = {
      ...req.body,
      tracking,
      trackingNumber: tracking[0]?.trackingNumber || req.body.trackingNumber,
      studentName: req.body.studentName || user.name,
      approvalStatus,
      approvedBy: isPrivileged ? user.name : undefined,
      approvedAt: isPrivileged ? Date.now() : undefined
    };
    const result = await client.mutation('orders:create', {
      ...payload
    });
    if (tracking.length) {
      await trackingService.ensureCacheEntries(tracking, true);
    }
    res.status(201).json({ order: result });
  } catch (error) {
    logger.error(error, 'Failed to create order');
    res.status(500).json({ error: 'Unable to create order' });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const order = await client.query('orders:getOne', { orderId: req.params.id });
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const hasGlobal = user.permissions?.canManagePartRequests;
  const hasOrders = user.permissions?.canManageOrders;
  const hasOwn = user.permissions?.canManageOwnPartRequests && isOwnOrder(order, user);
  if (!hasGlobal && !hasOwn && !hasOrders) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const tracking = normalizeTrackingPayload(req.body.tracking, req.body.trackingNumber, req.body.carrier);
    const payload = { ...req.body };
    if (Array.isArray(req.body.tracking) || req.body.trackingNumber !== undefined || tracking.length) {
      payload.tracking = tracking;
      payload.trackingNumber = tracking[0]?.trackingNumber || req.body.trackingNumber;
    }
    const result = await client.mutation('orders:update', {
      orderId: req.params.id,
      ...payload
    });
    if (tracking.length) {
      await trackingService.ensureCacheEntries(tracking, true);
    }
    res.json({ orderId: result.orderId });
  } catch (error) {
    logger.error(error, 'Failed to update order');
    res.status(500).json({ error: 'Unable to update order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const order = await client.query('orders:getOne', { orderId: req.params.id });
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const hasGlobal = user.permissions?.canManagePartRequests;
  const hasOrders = user.permissions?.canManageOrders;
  const hasOwn = user.permissions?.canManageOwnPartRequests && isOwnOrder(order, user);
  if (!hasGlobal && !hasOwn && !hasOrders) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await client.mutation('orders:deleteOrder', { orderId: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to delete order');
    res.status(500).json({ error: 'Unable to delete order' });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  if (!user.permissions?.canManagePartRequests && !user.permissions?.canManageOrders) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { status, trackingNumber } = req.body || {};
  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }
  try {
    const tracking = normalizeTrackingPayload(req.body.tracking, trackingNumber, req.body.carrier);
    const result = await client.mutation('orders:updateStatus', {
      orderId: req.params.id,
      status,
      trackingNumber: tracking[0]?.trackingNumber || trackingNumber,
      tracking: tracking.length ? tracking : undefined
    });
    if (tracking.length) {
      await trackingService.ensureCacheEntries(tracking, true);
    }
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to update order status');
    res.status(500).json({ error: 'Unable to update order status' });
  }
});

app.patch('/api/orders/:id/approval', async (req, res) => {
  const user = await requireAuth(req, res, 'canManagePartRequests');
  if (!user) return;
  const { approvalStatus } = req.body || {};
  if (!approvalStatus) {
    return res.status(400).json({ error: 'approvalStatus is required' });
  }
  try {
    await client.mutation('orders:update', {
      orderId: req.params.id,
      approvalStatus,
      approvedBy: approvalStatus === 'approved' ? user.name : undefined,
      approvedAt: approvalStatus === 'approved' ? Date.now() : undefined
    });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to update approval');
    res.status(500).json({ error: 'Unable to update approval' });
  }
});

app.patch('/api/orders/:id/group', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageOrders');
  if (!user) return;
  const { groupId } = req.body || {};
  try {
    if (!groupId) {
      const invs = await client.query('invoices:list', { orderId: req.params.id });
      if (Array.isArray(invs) && invs.length) {
        return res.status(400).json({ error: 'Cannot ungroup an order that has invoices' });
      }
    }
    const result = await client.mutation('orders:assignGroup', {
      orderId: req.params.id,
      groupId
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to assign group');
    res.status(500).json({ error: 'Unable to assign group' });
  }
});

app.get('/api/order-groups', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const groups = await client.query('orderGroups:list', {});
    res.json({ groups });
  } catch (error) {
    logger.error(error, 'Failed to load order groups');
    res.status(500).json({ error: 'Unable to load order groups' });
  }
});

app.post('/api/order-groups', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageOrders');
  if (!user) return;
  if (!req.body) {
    return res.status(400).json({ error: 'Group payload is required' });
  }
  try {
    const tracking = normalizeTrackingPayload(req.body.tracking, req.body.trackingNumber, req.body.carrier);
    const payload = {
      ...req.body,
      tracking,
      trackingNumber: tracking[0]?.trackingNumber || req.body.trackingNumber
    };
    const group = await client.mutation('orderGroups:create', payload);
    if (tracking.length) {
      await trackingService.ensureCacheEntries(tracking, true);
    }
    res.status(201).json(group);
  } catch (error) {
    logger.error(error, 'Failed to create order group');
    res.status(500).json({ error: 'Unable to create order group' });
  }
});

app.patch('/api/order-groups/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageOrders');
  if (!user) return;
  try {
    const tracking = normalizeTrackingPayload(req.body.tracking, req.body.trackingNumber, req.body.carrier);
    const payload = { ...req.body };
    if (Array.isArray(req.body.tracking) || req.body.trackingNumber !== undefined || tracking.length) {
      payload.tracking = tracking;
      payload.trackingNumber = tracking[0]?.trackingNumber || req.body.trackingNumber;
    }
    const group = await client.mutation('orderGroups:update', {
      groupId: req.params.id,
      ...payload
    });
    if (tracking.length) {
      await trackingService.ensureCacheEntries(tracking, true);
    }
    res.json(group);
  } catch (error) {
    logger.error(error, 'Failed to update order group');
    res.status(500).json({ error: 'Unable to update order group' });
  }
});

app.delete('/api/order-groups/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageOrders');
  if (!user) return;
  try {
    const result = await client.mutation('orderGroups:remove', { groupId: req.params.id });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete order group');
    res.status(500).json({ error: 'Unable to delete order group' });
  }
});

app.get('/api/students', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const students = await client.query('students:list', {
      activeOnly: req.query.activeOnly === 'true'
    });
    res.json({ students });
  } catch (error) {
    logger.error(error, 'Failed to load students');
    res.status(500).json({ error: 'Unable to load students' });
  }
});

app.post('/api/students', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  const { name, subteam, active } = req.body || {};
  if (!name || active === undefined) {
    return res.status(400).json({ error: 'name and active are required' });
  }

  try {
    const result = await client.mutation('students:upsert', { name, subteam, active });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to upsert student');
    res.status(500).json({ error: 'Unable to upsert student' });
  }
});

app.get('/api/vendors/configs', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const [customConfigs, integrationSettings] = await Promise.all([
      client.query('vendors:list', {}),
      client.query('vendorIntegrations:list', {})
    ]);
    const canManage = Boolean(user.permissions?.canManageVendors);
    const integrationMap = new Map((integrationSettings || []).map(entry => [entry.vendorKey, entry]));
    const builtin = builtinVendors.map(def => {
      const record = integrationMap.get(def.key) || null;
      const settings = record?.settings || {};
      const fields = (def.integrationFields || []).map(field => {
        const stored = settings[field.key] || '';
        return {
          key: field.key,
          label: field.label,
          required: Boolean(field.required),
          secret: Boolean(field.secret),
          type: field.type || 'text',
          placeholder: field.placeholder,
          value: canManage ? stored : '',
          hasValue: Boolean(stored)
        };
      });
      return {
        key: def.key,
        vendor: def.vendor,
        slug: def.slug,
        description: def.description,
        baseUrl: def.baseUrl,
        productUrlTemplate: def.productUrlTemplate,
        partNumberPattern: def.partNumberPattern,
        capabilities: def.capabilities,
        detectionHints: def.detectionHints,
        integrationFields: fields,
        requiresCredentials: fields.length > 0,
        hasCredentialsConfigured: fields.length ? fields.every(f => f.hasValue || !f.required) : true,
        settings: canManage ? settings : undefined,
        createdAt: record?.createdAt,
        updatedAt: record?.updatedAt,
        source: 'builtin'
      };
    });
    res.json({ vendors: customConfigs, custom: customConfigs, builtin });
  } catch (error) {
    logger.error(error, 'Failed to load vendor configs');
    res.status(500).json({ error: 'Unable to load vendor configs' });
  }
});

app.get('/api/tags', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const tags = await client.query('tags:list', {});
    res.json({ tags });
  } catch (error) {
    logger.error(error, 'Failed to list tags');
    res.status(500).json({ error: 'Unable to load tags' });
  }
});

app.post('/api/tags', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color } = req.body || {};
  if (!label) return res.status(400).json({ error: 'label required' });
  try {
    const result = await client.mutation('tags:create', { label, color });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create tag');
    res.status(500).json({ error: 'Unable to create tag' });
  }
});

app.delete('/api/tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  try {
    const result = await client.mutation('tags:remove', { id: req.params.id });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete tag');
    res.status(500).json({ error: 'Unable to delete tag' });
  }
});

app.patch('/api/tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color } = req.body || {};
  try {
    await client.mutation('tags:update', { id: req.params.id, label, color });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to update tag');
    res.status(500).json({ error: 'Unable to update tag' });
  }
});

app.get('/api/priority-tags', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const items = await client.query('priorityTags:list', {});
    res.json({ priorities: items });
  } catch (error) {
    logger.error(error, 'Failed to list priority tags');
    res.status(500).json({ error: 'Unable to load priority tags' });
  }
});

app.post('/api/priority-tags', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color, sortOrder } = req.body || {};
  if (!label) return res.status(400).json({ error: 'label required' });
  try {
    const result = await client.mutation('priorityTags:create', { label, color, sortOrder });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create priority');
    res.status(500).json({ error: 'Unable to create priority' });
  }
});

app.patch('/api/priority-tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color, sortOrder } = req.body || {};
  try {
    await client.mutation('priorityTags:update', { id: req.params.id, label, color, sortOrder });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to update priority');
    res.status(500).json({ error: 'Unable to update priority' });
  }
});

app.delete('/api/priority-tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  try {
    const result = await client.mutation('priorityTags:remove', { id: req.params.id });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete priority');
    res.status(500).json({ error: 'Unable to delete priority' });
  }
});

app.get('/api/status-tags', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const items = await client.query('statusTags:list', {});
    res.json({ statuses: items });
  } catch (error) {
    logger.error(error, 'Failed to list status tags');
    res.status(500).json({ error: 'Unable to load status tags' });
  }
});

app.post('/api/status-tags', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color, sortOrder } = req.body || {};
  if (!label) return res.status(400).json({ error: 'label required' });
  try {
    const result = await client.mutation('statusTags:create', { label, color, sortOrder });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create status');
    res.status(500).json({ error: 'Unable to create status' });
  }
});

app.patch('/api/status-tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color, sortOrder } = req.body || {};
  try {
    await client.mutation('statusTags:update', { id: req.params.id, label, color, sortOrder });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to update status');
    res.status(500).json({ error: 'Unable to update status' });
  }
});

app.delete('/api/status-tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  try {
    const result = await client.mutation('statusTags:remove', { id: req.params.id });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete status');
    res.status(500).json({ error: 'Unable to delete status' });
  }
});

app.get('/api/reimbursement-tags', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  try {
    const items = await client.query('reimbursementTags:list', {});
    res.json({ statuses: items });
  } catch (error) {
    logger.error(error, 'Failed to list reimbursement tags');
    res.status(500).json({ error: 'Unable to load reimbursement tags' });
  }
});

app.post('/api/reimbursement-tags', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color, sortOrder } = req.body || {};
  if (!label) return res.status(400).json({ error: 'label required' });
  try {
    const result = await client.mutation('reimbursementTags:create', { label, color, sortOrder });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create reimbursement status');
    res.status(500).json({ error: 'Unable to create reimbursement status' });
  }
});

app.patch('/api/reimbursement-tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  const { label, color, sortOrder } = req.body || {};
  try {
    await client.mutation('reimbursementTags:update', { id: req.params.id, label, color, sortOrder });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to update reimbursement status');
    res.status(500).json({ error: 'Unable to update reimbursement status' });
  }
});

app.delete('/api/reimbursement-tags/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageTags');
  if (!user) return;
  try {
    const result = await client.mutation('reimbursementTags:remove', { id: req.params.id });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete reimbursement status');
    res.status(500).json({ error: 'Unable to delete reimbursement status' });
  }
});

app.post('/api/vendors/configs', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageVendors');
  if (!user) return;
  if (!req.body || !req.body.vendor) {
    return res.status(400).json({ error: 'vendor is required' });
  }
  try {
    const result = await client.mutation('vendors:upsert', req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create vendor config');
    res.status(500).json({ error: 'Unable to create vendor config' });
  }
});

app.patch('/api/vendors/configs/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageVendors');
  if (!user) return;
  try {
    const result = await client.mutation('vendors:upsert', { id: req.params.id, ...req.body });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to update vendor config');
    res.status(500).json({ error: 'Unable to update vendor config' });
  }
});

app.delete('/api/vendors/configs/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageVendors');
  if (!user) return;
  try {
    const result = await client.mutation('vendors:remove', { id: req.params.id });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to delete vendor config');
    res.status(500).json({ error: 'Unable to delete vendor config' });
  }
});

app.patch('/api/vendors/integrations/:key', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageVendors');
  if (!user) return;
  const def = getBuiltinVendor(req.params.key);
  if (!def) {
    return res.status(404).json({ error: 'Unknown vendor integration' });
  }
  const provided = req.body?.settings;
  if (provided && typeof provided !== 'object') {
    return res.status(400).json({ error: 'settings must be an object' });
  }
  const settings = {};
  const missing = [];
  (def.integrationFields || []).forEach(field => {
    const raw = provided ? provided[field.key] : undefined;
    const val = typeof raw === 'string' ? raw.trim() : raw;
    if (val === undefined || val === null || val === '') {
      if (field.required) missing.push(field.label || field.key);
      return;
    }
    settings[field.key] = String(val);
  });
  if (missing.length) {
    return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }
  try {
    await client.mutation('vendorIntegrations:save', {
      vendorKey: def.key,
      settings,
      userId: user._id?.toString()
    });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, `Failed to save ${def.key} integration`);
    res.status(500).json({ error: 'Unable to save vendor integration' });
  }
});

app.post('/api/vendors/resolve', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const vendorKey = String(req.body?.vendorKey || '').toLowerCase();
  const url = req.body?.url;
  if (!vendorKey || !url) {
    return res.status(400).json({ error: 'vendorKey and url are required' });
  }
  const def = getBuiltinVendor(vendorKey);
  if (!def) return res.status(404).json({ error: 'Unknown vendor integration' });
  try {
    if (def.key === 'digikey') {
      const result = await digikeyService.resolveProductUrl(url);
      return res.json(result);
    }
    if (def.key === 'mouser') {
      const result = await mouserService.resolveProductUrl(url);
      return res.json(result);
    }
    if (def.key === 'amazon') {
      const result = await resolveAmazonProductUrl(url);
      return res.json(result);
    }
    if (def.key === 'revrobotics') {
      const result = await resolveRevRoboticsProductUrl(url);
      return res.json(result);
    }
    if (def.key === 'wcp') {
      const result = await resolveWcpProductUrl(url);
      return res.json(result);
    }
    return res.status(501).json({ error: `Resolver not implemented for ${def.vendor}` });
  } catch (error) {
    logger.error(error, 'Vendor URL resolve failed');
    res.status(500).json({ error: error.message || 'Failed to resolve vendor url' });
  }
});

app.get('/api/tracking/settings', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditTrackingSettings');
  if (!user) return;
  try {
    const settings = await client.query('tracking:getSettings', {});
    const stockRefresh = Number(settings?.wcpStockRefreshMinutes);
    const mergedSettings = {
      ...settings,
      wcpStockRefreshMinutes:
        Number.isFinite(stockRefresh) && stockRefresh > 0
          ? stockRefresh
          : stockStatusService.refreshMinutes || 30
    };
    res.json({ settings: mergedSettings });
  } catch (error) {
    logger.error(error, 'Failed to load tracking settings');
    res.status(500).json({ error: 'Unable to load tracking settings' });
  }
});

app.patch('/api/tracking/settings', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditTrackingSettings');
  if (!user) return;
  const refreshMinutes = Number(req.body?.refreshMinutes ?? 30);
  if (!Number.isFinite(refreshMinutes) || refreshMinutes <= 0) {
    return res.status(400).json({ error: 'refreshMinutes must be a positive number' });
  }
  const wcpStockRefreshMinutes = Number(req.body?.wcpStockRefreshMinutes ?? 30);
  if (!Number.isFinite(wcpStockRefreshMinutes) || wcpStockRefreshMinutes <= 0) {
    return res.status(400).json({ error: 'wcpStockRefreshMinutes must be a positive number' });
  }
  try {
    await trackingService.updateSettings({
      upsClientId: req.body?.upsClientId,
      upsClientSecret: req.body?.upsClientSecret,
      uspsUserId: req.body?.uspsUserId,
      fedexClientId: req.body?.fedexClientId,
      fedexClientSecret: req.body?.fedexClientSecret,
      refreshMinutes,
      wcpStockRefreshMinutes
    });
    await stockStatusService.loadSettings();
    stockStatusService.start();
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to save tracking settings');
    res.status(500).json({ error: 'Unable to save tracking settings' });
  }
});

app.post('/api/tracking/refresh', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditTrackingSettings');
  if (!user) return;
  try {
    const result = await trackingService.refreshAllNow();
    res.json({ ok: true, lastError: result.lastError });
  } catch (error) {
    logger.error(error, 'Manual tracking refresh failed');
    res.status(500).json({ error: 'Unable to refresh tracking now' });
  }
});

app.post('/api/stock/requests/refresh', async (req, res) => {
  const user = await requireAuth(req, res, 'canEditTrackingSettings');
  if (!user) return;
  try {
    const result = await stockStatusService.refreshAllNow();
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error(error, 'Manual WCP stock refresh failed');
    res.status(500).json({ error: 'Unable to refresh WCP stock now' });
  }
});

function deriveSelector(el) {
  if (!el || !el.tagName) return null;
  const tag = el.tagName.toLowerCase();
  const cls = (el.attribs?.class || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(c => `.${c}`)
    .join('');
  return cls ? `${tag}${cls}` : tag;
}

function sanitizeVendorImportNotes(rawNotes) {
  if (typeof rawNotes !== 'string') return rawNotes;
  const segments = rawNotes
    .split('·')
    .map((segment) => String(segment || '').trim())
    .filter(Boolean);
  if (!segments.length) return '';
  const hasVendorImportSegment = segments.some(
    (segment) => /^vendor\s+import$/i.test(segment) || /vendor\s+import/i.test(segment),
  );
  if (!hasVendorImportSegment) {
    return segments.join(' · ');
  }
  const filtered = segments.filter((segment) => {
    const lower = segment.toLowerCase();
    if (lower.startsWith('stock:')) return false;
    if (lower.startsWith('in stock')) return false;
    return true;
  });
  return filtered.join(' · ');
}

function collectCandidates($) {
  const titleCandidates = [];
  const priceCandidates = [];

  $('meta[property="og:title"], meta[name="twitter:title"]').each((_, el) => {
    const content = $(el).attr('content');
    if (content) titleCandidates.push({ text: content.trim(), selector: 'meta[property="og:title"]' });
  });
  const commonTitles = ['h1', '.product-title', '.title', 'title'];
  commonTitles.forEach(sel => {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text) titleCandidates.push({ text, selector: deriveSelector(el) || sel });
    });
  });
  $('body *').each((_, el) => {
    const txt = ($(el).text() || '').trim().replace(/\s+/g, ' ');
    if (!txt) return;
    const selector = deriveSelector(el);
    if ((/\$\s*\d/.test(txt) || /\d+(\.\d{2})/.test(txt)) && txt.length <= 120 && !/function/i.test(txt)) {
      priceCandidates.push({ text: txt, selector });
    }
  });

  const unique = (arr) => {
    const seen = new Set();
    return arr.filter(c => {
      const key = (c.text || '') + '|' + (c.selector || '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  };

  return {
    titles: unique(titleCandidates),
    prices: unique(priceCandidates)
  };
}

function parseShopifyMeta(html) {
  const metaMatch = html.match(/var meta\s*=\s*(\{[\s\S]*?\});/);
  if (!metaMatch) return null;
  try {
    const obj = JSON.parse(metaMatch[1]);
    const product = obj?.product;
    if (!product || !product.variants?.length) return null;
    return {
      vendor: product.vendor,
      variants: product.variants.map(v => ({
        id: v.id,
        name: v.name || v.title,
        price: v.price ? Number(v.price) / 100 : undefined,
        sku: v.sku,
        publicTitle: v.public_title
      }))
    };
  } catch (e) {
    logger.warn(e, 'Failed to parse Shopify meta');
    return null;
  }
}

async function getShopifyVariantPrice(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    const productsIndex = parts.findIndex(p => p === 'products');
    if (productsIndex === -1 || productsIndex === parts.length - 1) return null;
    const handle = parts[productsIndex + 1];
    const variantId = u.searchParams.get('variant');
    if (!handle) return null;
    const jsUrl = `${u.origin}/products/${handle}.js`;
    const resp = await fetch(jsUrl);
    if (!resp.ok) return null;
    const data = await resp.json();
    const variants = data?.variants || [];
    let variant = variants[0];
    if (variantId) {
      const found = variants.find(v => String(v.id) === String(variantId));
      if (found) variant = found;
    }
    if (!variant) return null;
    return {
      priceText: variant.price ? (Number(variant.price) / 100).toFixed(2) : '',
      priceNumber: variant.price ? Number(variant.price) / 100 : undefined,
      title: variant.name || variant.title
    };
  } catch (e) {
    logger.warn(e, 'Shopify variant fetch failed');
    return null;
  }
}

async function extractVendorProductFromUrl({ url, selectors = {}, headers = {} }) {
  if (!url) throw new Error('url is required');
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
  const html = await resp.text();
  const finalUrl = resp.url || url;
  const $ = cheerio.load(html);

  const shopifyMeta = parseShopifyMeta(html);
  let shopifyVariant = null;
  if (shopifyMeta?.variants?.length) {
    const u = new URL(finalUrl);
    const variantId = u.searchParams.get('variant');
    shopifyVariant =
      shopifyMeta.variants.find(v => String(v.id) === String(variantId)) ||
      shopifyMeta.variants[0];
  }

  const picks = {};
  const safePick = (sel) => {
    if (!sel) return '';
    try {
      return $(sel).first().text().trim();
    } catch (err) {
      logger.warn({ selector: sel, err }, 'Invalid selector during extraction');
      return '';
    }
  };

  picks.name = safePick(selectors.nameSelector);
  picks.price = safePick(selectors.priceSelector);

  const shopifyPrice = await getShopifyVariantPrice(finalUrl);
  if (shopifyPrice?.priceText) {
    picks.price = shopifyPrice.priceText;
  }
  if (shopifyPrice?.title && !picks.name) {
    picks.name = shopifyPrice.title;
  }
  if (shopifyVariant?.price !== undefined) {
    picks.price = shopifyVariant.price.toFixed(2);
  }
  if (shopifyVariant?.name && !picks.name) {
    picks.name = shopifyVariant.name;
  }

  const candidates = collectCandidates($);
  return {
    picks,
    candidates,
    productUrl: finalUrl,
    shopify: shopifyMeta
      ? { vendor: shopifyMeta.vendor, variant: shopifyVariant, variants: shopifyMeta.variants }
      : null
  };
}

function normalizeWcpUrl(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function buildWcpProductUrl(partNumber) {
  if (!partNumber) return null;
  return `https://wcproducts.com/products/${encodeURIComponent(partNumber)}`;
}

const WCP_STOREFRONT_API_VERSION = '2026-01';
const WCP_QTY_PROBE = 1;
const WCP_LOOKUP_CACHE_TTL_MS = 10 * 60 * 1000;
const WCP_LOOKUP_STALE_TTL_MS = 6 * 60 * 60 * 1000;
const WCP_LOOKUP_MIN_GAP_MS = 800;
const WCP_LOOKUP_MAX_ATTEMPTS = 3;
const WCP_LOOKUP_BASE_BACKOFF_MS = 1200;
const wcpLookupCache = new Map();
let wcpLookupQueue = Promise.resolve();
let wcpNextLookupAt = 0;

function sleep(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, safeMs));
}

function parseRetryAfterMs(value) {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.round(asNumber * 1000);
  const asDate = Date.parse(String(value));
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function nextBackoffMs(attempt, retryAfterHeader) {
  const fromHeader = parseRetryAfterMs(retryAfterHeader);
  if (fromHeader !== null) return fromHeader;
  const base = WCP_LOOKUP_BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 350);
  return base + jitter;
}

async function queueWcpLookup(task) {
  let releaseQueue = () => {};
  const gate = new Promise((resolve) => {
    releaseQueue = resolve;
  });
  const prev = wcpLookupQueue;
  wcpLookupQueue = prev.then(() => gate, () => gate);
  await prev.catch(() => {});
  try {
    const waitMs = Math.max(0, wcpNextLookupAt - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    return await task();
  } finally {
    wcpNextLookupAt = Date.now() + WCP_LOOKUP_MIN_GAP_MS;
    releaseQueue();
  }
}

async function fetchWcpWithRetry(url, options = {}, label = 'WCP request') {
  let response = null;
  for (let attempt = 1; attempt <= WCP_LOOKUP_MAX_ATTEMPTS; attempt += 1) {
    let fetchError = null;
    try {
      response = await fetch(url, options);
    } catch (error) {
      fetchError = error;
    }
    if (fetchError) {
      if (attempt >= WCP_LOOKUP_MAX_ATTEMPTS) throw fetchError;
      const retryDelayMs = nextBackoffMs(attempt, null);
      logger.warn(
        {
          url,
          attempt,
          retryDelayMs,
          err: fetchError?.message || fetchError
        },
        `${label} network error; retrying`
      );
      await sleep(retryDelayMs);
      continue;
    }
    if (response.ok) return response;
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt >= WCP_LOOKUP_MAX_ATTEMPTS) return response;
    const retryDelayMs = nextBackoffMs(attempt, response.headers?.get('retry-after'));
    logger.warn(
      {
        url,
        status: response.status,
        attempt,
        retryDelayMs
      },
      `${label} failed; retrying`
    );
    await sleep(retryDelayMs);
  }
  return response;
}

function deepCloneWcpLookup(value) {
  if (!value || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function readWcpCacheEntry(partNumber) {
  const key = normalizeWcpSku(partNumber);
  if (!key) return null;
  const entry = wcpLookupCache.get(key);
  if (!entry || !entry.result) return null;
  return {
    key,
    result: deepCloneWcpLookup(entry.result),
    cachedAt: entry.cachedAt
  };
}

function storeWcpCacheEntry(partNumber, result) {
  const key = normalizeWcpSku(partNumber);
  if (!key || !result) return;
  wcpLookupCache.set(key, {
    result: deepCloneWcpLookup(result),
    cachedAt: Date.now()
  });
}

function annotateStaleWcpResult(result, cachedAt) {
  const stale = deepCloneWcpLookup(result) || {};
  const checkedAt = cachedAt || Date.now();
  stale.meta = {
    ...(stale.meta || {}),
    staleCache: true,
    staleCacheAt: new Date(checkedAt).toISOString()
  };
  stale.stock = {
    ...(stale.stock || {}),
    checkedAt: stale.stock?.checkedAt || new Date(checkedAt).toISOString()
  };
  return stale;
}

function normalizeWcpHandle(value) {
  if (!value) return null;
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/^products\//, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

function normalizeWcpSku(value) {
  if (!value) return null;
  return String(value).trim().toUpperCase();
}

function wcpRequestHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
  };
}

function extractWcpStorefrontToken(html) {
  if (!html) return null;
  const match = html.match(/<script id="shopify-features" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed?.accessToken || null;
  } catch (error) {
    logger.warn(error, 'Failed to parse WCP Shopify features');
    return null;
  }
}

function parseShopifyGidNumericId(gid) {
  if (!gid) return null;
  const match = String(gid).match(/\/(\d+)$/);
  return match?.[1] || null;
}

function classifyWcpStockStatusFromStorefront(variant) {
  if (!variant) return 'unknown';
  if (variant.availableForSale === false) return 'sold_out';
  if (variant.availableForSale === true && variant.currentlyNotInStock === true) return 'backordered';
  if (variant.availableForSale === true) return 'in_stock';
  return 'unknown';
}

function classifyWcpStockStatusFromProductVariant(variant) {
  if (!variant) return 'unknown';
  if (variant.available === false) return 'sold_out';
  if (variant.available === true) return 'in_stock';
  return 'unknown';
}

function classifyWcpStockStatusFromHtml(html) {
  if (!html) return 'unknown';
  const $ = cheerio.load(html);
  const soldOutLabel = $('.tt-label-out-stock').first().text().trim().toLowerCase();
  if (soldOutLabel.includes('sold out')) return 'sold_out';
  const addToCartText = $('.btn-addtocart').first().text().trim().toLowerCase();
  if (addToCartText.includes('preorder')) return 'backordered';
  if (addToCartText.includes('add to cart')) return 'in_stock';
  return 'unknown';
}

function wcpStockLabel(status) {
  if (status === 'in_stock') return 'In Stock';
  if (status === 'backordered') return 'Backordered';
  if (status === 'sold_out') return 'Sold Out';
  return 'Unknown';
}

function formatWcpVariantPrice(priceValue) {
  const numeric = Number(priceValue);
  if (!Number.isFinite(numeric)) return undefined;
  return (numeric / 100).toFixed(2);
}

async function fetchWcpStorefrontVariants(handle, accessToken) {
  if (!handle || !accessToken) return [];
  const query = `query WcpProduct($handle: String!) {
    productByHandle(handle: $handle) {
      variants(first: 100) {
        edges {
          node {
            id
            sku
            availableForSale
            currentlyNotInStock
          }
        }
      }
    }
  }`;
  try {
    const resp = await fetch(`https://wcproducts.com/api/${WCP_STOREFRONT_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken
      },
      body: JSON.stringify({ query, variables: { handle } })
    });
    const payload = await resp.json();
    if (!resp.ok) {
      logger.warn({ status: resp.status, payload }, 'WCP storefront API request failed');
      return [];
    }
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      logger.warn({ errors: payload.errors }, 'WCP storefront API returned GraphQL errors');
    }
    return (payload?.data?.productByHandle?.variants?.edges || [])
      .map(edge => edge?.node)
      .filter(Boolean);
  } catch (error) {
    logger.warn(error, 'WCP storefront API lookup failed');
    return [];
  }
}

function extractSetCookieHeaders(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values)) return values;
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function updateCookieJarFromHeaders(cookieJar, headers) {
  extractSetCookieHeaders(headers).forEach(rawCookie => {
    const firstSegment = String(rawCookie || '').split(';')[0];
    const separatorIndex = firstSegment.indexOf('=');
    if (separatorIndex <= 0) return;
    const key = firstSegment.slice(0, separatorIndex).trim();
    const value = firstSegment.slice(separatorIndex + 1).trim();
    if (!key) return;
    cookieJar.set(key, value);
  });
}

function buildCookieHeader(cookieJar) {
  if (!cookieJar?.size) return '';
  return Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function withCookieHeader(baseHeaders, cookieJar) {
  const cookieHeader = buildCookieHeader(cookieJar);
  if (!cookieHeader) return { ...baseHeaders };
  return { ...baseHeaders, Cookie: cookieHeader };
}

function parseWcpCartQuantity(html, variantId, requestedQty) {
  if (!html) return null;
  const $ = cheerio.load(html);
  let backorderNode = null;
  if (variantId) {
    const variantMatch = $(`a[href*="variant=${variantId}"]`).first();
    if (variantMatch.length) {
      backorderNode = variantMatch.closest('tr').find('.tt-backorder_qua').first();
      if (!backorderNode.length) {
        backorderNode = variantMatch.closest('td').find('.tt-backorder_qua').first();
      }
      if (!backorderNode.length) {
        backorderNode = variantMatch.parent().find('.tt-backorder_qua').first();
      }
    }
  }
  if (!backorderNode?.length) {
    backorderNode = $('.tt-backorder_qua').first();
  }
  if (!backorderNode?.length) return null;
  const currentQtyRaw = Number(backorderNode.attr('data-current-qty'));
  const currentQty = Number.isFinite(currentQtyRaw) ? Math.max(0, Math.round(currentQtyRaw)) : null;
  const text = backorderNode.text().replace(/\s+/g, ' ').trim();
  return {
    requestedQty: Number.isFinite(requestedQty) ? Math.round(requestedQty) : null,
    inStockQty: currentQty,
    rawMessage: text || null
  };
}

function parseWcpCartQuantities(html) {
  const results = new Map();
  if (!html) return results;
  const $ = cheerio.load(html);
  $('.tt-backorder_qua').each((_, element) => {
    const node = $(element);
    const currentQtyRaw = Number(node.attr('data-current-qty'));
    const currentQty = Number.isFinite(currentQtyRaw)
      ? Math.max(0, Math.round(currentQtyRaw))
      : null;
    const rawMessage = node.text().replace(/\s+/g, ' ').trim() || null;
    const link =
      node.closest('tr').find('a[href*="variant="]').first().attr('href') ||
      node.closest('td').find('a[href*="variant="]').first().attr('href') ||
      node.parent().find('a[href*="variant="]').first().attr('href') ||
      '';
    const match = String(link).match(/[?&]variant=(\d+)/i);
    const variantId = match?.[1] ? String(match[1]) : null;
    if (!variantId) return;
    results.set(variantId, {
      inStockQty: currentQty,
      rawMessage
    });
  });
  return results;
}

function chunkArray(values = [], chunkSize = 20) {
  const safeSize = Math.max(1, Math.round(Number(chunkSize) || 1));
  const chunks = [];
  for (let i = 0; i < values.length; i += safeSize) {
    chunks.push(values.slice(i, i + safeSize));
  }
  return chunks;
}

async function clearWcpCart(cookieJar) {
  try {
    await fetch('https://wcproducts.com/cart/clear.js', {
      method: 'GET',
      headers: withCookieHeader(wcpRequestHeaders(), cookieJar)
    });
  } catch (error) {
    logger.warn(error, 'Failed to clear WCP cart after qty scrape');
  }
}

async function scrapeWcpQuantitiesViaCartBatch(variantIds = [], requestedQty = WCP_QTY_PROBE, chunkSize = 20) {
  const uniqueVariantIds = Array.from(
    new Set(
      (variantIds || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
  const snapshots = new Map();
  if (!uniqueVariantIds.length) return snapshots;
  const quantity = Math.max(1, Math.round(Number(requestedQty) || 1));
  const cookieJar = new Map();
  try {
    const chunks = chunkArray(uniqueVariantIds, chunkSize);
    for (const chunk of chunks) {
      const addResp = await fetch('https://wcproducts.com/cart/add.js', {
        method: 'POST',
        headers: withCookieHeader(
          {
            ...wcpRequestHeaders(),
            Accept: 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            Origin: 'https://wcproducts.com',
            Referer: 'https://wcproducts.com/cart'
          },
          cookieJar
        ),
        body: JSON.stringify({
          items: chunk.map((variantId) => ({
            id: Number.isFinite(Number(variantId)) ? Number(variantId) : variantId,
            quantity
          }))
        }),
        redirect: 'follow'
      });
      updateCookieJarFromHeaders(cookieJar, addResp.headers);
      if (!addResp.ok) {
        logger.warn(
          { status: addResp.status, batchSize: chunk.length },
          'WCP cart add failed during batch qty scrape'
        );
        await clearWcpCart(cookieJar);
        continue;
      }
      const cartResp = await fetch('https://wcproducts.com/cart', {
        method: 'GET',
        headers: withCookieHeader(wcpRequestHeaders(), cookieJar),
        redirect: 'follow'
      });
      updateCookieJarFromHeaders(cookieJar, cartResp.headers);
      if (!cartResp.ok) {
        logger.warn(
          { status: cartResp.status, batchSize: chunk.length },
          'WCP cart page fetch failed during batch qty scrape'
        );
        await clearWcpCart(cookieJar);
        continue;
      }
      const cartHtml = await cartResp.text();
      const batchSnapshots = parseWcpCartQuantities(cartHtml);
      chunk.forEach((variantId) => {
        const normalizedVariantId = String(variantId);
        const snapshot = batchSnapshots.get(normalizedVariantId);
        if (!snapshot) return;
        snapshots.set(normalizedVariantId, {
          requestedQty: quantity,
          inStockQty: snapshot.inStockQty,
          rawMessage: snapshot.rawMessage
        });
      });
      await clearWcpCart(cookieJar);
      await sleep(100);
    }
  } catch (error) {
    logger.warn(error, 'WCP cart batch quantity scrape failed');
  } finally {
    await clearWcpCart(cookieJar);
  }
  return snapshots;
}

async function scrapeWcpQuantityViaCart(variantId, requestedQty = WCP_QTY_PROBE) {
  if (!variantId) return null;
  const cookieJar = new Map();
  try {
    const addResp = await fetch('https://wcproducts.com/cart/add.js', {
      method: 'POST',
      headers: withCookieHeader(
        {
          ...wcpRequestHeaders(),
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Origin: 'https://wcproducts.com',
          Referer: 'https://wcproducts.com/cart'
        },
        cookieJar
      ),
      body: new URLSearchParams({
        id: String(variantId),
        quantity: String(Math.max(1, Math.round(requestedQty)))
      }).toString(),
      redirect: 'follow'
    });
    updateCookieJarFromHeaders(cookieJar, addResp.headers);
    if (!addResp.ok) {
      logger.warn({ status: addResp.status, variantId }, 'WCP cart add failed during qty scrape');
      return null;
    }
    const cartResp = await fetch('https://wcproducts.com/cart', {
      method: 'GET',
      headers: withCookieHeader(wcpRequestHeaders(), cookieJar),
      redirect: 'follow'
    });
    updateCookieJarFromHeaders(cookieJar, cartResp.headers);
    if (!cartResp.ok) {
      logger.warn({ status: cartResp.status, variantId }, 'WCP cart page fetch failed during qty scrape');
      return null;
    }
    const cartHtml = await cartResp.text();
    return parseWcpCartQuantity(cartHtml, variantId, requestedQty);
  } catch (error) {
    logger.warn(error, 'WCP cart quantity scrape failed');
    return null;
  } finally {
    await clearWcpCart(cookieJar);
  }
}

function extractWcpPartFromUrl(urlString) {
  if (!urlString) return null;
  try {
    const url = new URL(urlString);
    const parts = (url.pathname || '').split('/').filter(Boolean);
    const productsIndex = parts.findIndex(part => part.toLowerCase() === 'products');
    if (productsIndex !== -1 && parts[productsIndex + 1]) {
      return decodeURIComponent(parts[productsIndex + 1]);
    }
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : null;
  } catch (err) {
    return null;
  }
}

async function resolveWcpProductUrl(rawUrl) {
  if (!rawUrl) throw new Error('url is required');
  const trimmed = String(rawUrl).trim();
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) {
    const partNumber = trimmed;
    return {
      partNumber,
      productUrl: buildWcpProductUrl(partNumber)
    };
  }
  const normalized = normalizeWcpUrl(trimmed);
  const partNumber = extractWcpPartFromUrl(normalized);
  return {
    partNumber,
    productUrl: buildWcpProductUrl(partNumber) || normalized
  };
}

async function lookupWcpPart(partNumber, options = {}) {
  const normalizedPartNumber = normalizeWcpSku(partNumber);
  if (!normalizedPartNumber) {
    throw new Error('WCP part number is required.');
  }
  const includeQty = options?.includeQty !== false;
  const useQueue = options?.useQueue !== false;
  const cached = readWcpCacheEntry(normalizedPartNumber);
  if (cached && (Date.now() - cached.cachedAt) <= WCP_LOOKUP_CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const lookupTask = async () => {
      const warmCache = readWcpCacheEntry(normalizedPartNumber);
      if (warmCache && (Date.now() - warmCache.cachedAt) <= WCP_LOOKUP_CACHE_TTL_MS) {
        return warmCache.result;
      }
      const productUrl = buildWcpProductUrl(normalizedPartNumber);
      const productJsUrl = `${new URL(productUrl).origin}/products/${encodeURIComponent(normalizedPartNumber)}.js`;
      const productResp = await fetchWcpWithRetry(
        productJsUrl,
        {
          method: 'GET',
          headers: {
            ...wcpRequestHeaders(),
            Accept: 'application/json, text/javascript, */*; q=0.01',
            Referer: productUrl
          }
        },
        'WCP product JSON request'
      );
      if (!productResp.ok) {
        throw new Error(`WCP product JSON request failed (${productResp.status}).`);
      }
      const productData = await productResp.json();
      let finalUrl = productUrl;
      const productJsFinalUrl = productResp.url || productJsUrl;
      try {
        const parsed = new URL(productJsFinalUrl);
        parsed.pathname = parsed.pathname.replace(/\.js$/i, '');
        parsed.search = '';
        parsed.hash = '';
        finalUrl = parsed.toString();
      } catch (_) {
        finalUrl = productUrl;
      }
      const productVariants = Array.isArray(productData?.variants) ? productData.variants : [];
      const preferredProductVariant =
        productVariants.find(variant => normalizeWcpSku(variant?.sku) === normalizedPartNumber) ||
        productVariants[0] ||
        null;

      const qtySnapshot = includeQty && preferredProductVariant?.id
        ? await scrapeWcpQuantityViaCart(preferredProductVariant.id, WCP_QTY_PROBE)
        : null;
      const inStockQty = Number.isFinite(qtySnapshot?.inStockQty) ? qtySnapshot.inStockQty : null;

      let stockStatus = classifyWcpStockStatusFromProductVariant(preferredProductVariant);
      let stockSource = 'shopify_product_json';
      if (
        stockStatus === 'in_stock' &&
        Number.isFinite(inStockQty) &&
        inStockQty <= 0 &&
        preferredProductVariant?.available === true
      ) {
        stockStatus = 'backordered';
        stockSource = 'wcp_cart_page';
      }
      if (stockStatus === 'unknown') {
        const pageResp = await fetchWcpWithRetry(
          finalUrl,
          {
            method: 'GET',
            redirect: 'follow',
            headers: wcpRequestHeaders()
          },
          'WCP product page request'
        );
        if (pageResp.ok) {
          finalUrl = pageResp.url || finalUrl;
          const pageHtml = await pageResp.text();
          const htmlStatus = classifyWcpStockStatusFromHtml(pageHtml);
          if (htmlStatus !== 'unknown') {
            stockStatus = htmlStatus;
            stockSource = 'wcp_product_page';
          }
        } else {
          logger.warn(
            { status: pageResp.status, partNumber: normalizedPartNumber, url: finalUrl },
            'WCP product page fallback failed while resolving unknown stock state'
          );
        }
      }

      const variantTitle = preferredProductVariant?.title;
      const productTitle = productData?.title || '';
      const picksName =
        variantTitle && variantTitle !== 'Default Title'
          ? `${productTitle} - ${variantTitle}`
          : productTitle;
      const picksPrice = formatWcpVariantPrice(preferredProductVariant?.price);
      const sku = normalizeWcpSku(preferredProductVariant?.sku) || normalizedPartNumber;
      const stock = {
        status: stockStatus,
        label: wcpStockLabel(stockStatus),
        statusSource: stockSource,
        availableForSale:
          typeof preferredProductVariant?.available === 'boolean'
            ? preferredProductVariant.available
            : null,
        currentlyNotInStock: stockStatus === 'backordered' ? true : null,
        inStockQty,
        quantitySource: qtySnapshot ? 'wcp_cart_page' : null,
        checkedAt: new Date().toISOString()
      };

      const meta = {
        partNumber: sku,
        manufacturerPartNumber: sku,
        sku,
        variantId: preferredProductVariant?.id || null,
        stockStatus: stock.status,
        stockLabel: stock.label,
        stockInStockQty: stock.inStockQty
      };

      const result = !picksName && !picksPrice
        ? {
            picks: { name: picksName, price: picksPrice },
            productUrl: finalUrl,
            meta,
            stock,
            message: 'WCP page did not return product details.'
          }
        : {
            picks: { name: picksName, price: picksPrice },
            productUrl: finalUrl,
            meta,
            stock
          };
      if (includeQty || !warmCache) {
        storeWcpCacheEntry(normalizedPartNumber, result);
      }
      return result;
    };
    const fresh = useQueue
      ? await queueWcpLookup(lookupTask)
      : await lookupTask();
    return deepCloneWcpLookup(fresh);
  } catch (error) {
    const staleCandidate = readWcpCacheEntry(normalizedPartNumber) || cached;
    if (staleCandidate && (Date.now() - staleCandidate.cachedAt) <= WCP_LOOKUP_STALE_TTL_MS) {
      logger.warn(
        { partNumber: normalizedPartNumber, err: error?.message || error },
        'WCP lookup failed; serving stale cached value'
      );
      return annotateStaleWcpResult(staleCandidate.result, staleCandidate.cachedAt);
    }
    throw error;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const workerCount = Math.max(1, Math.min(list.length, Math.round(Number(concurrency) || 1)));
  const results = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      results[index] = await mapper(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function lookupWcpPartsBatch(partNumbers = [], options = {}) {
  const includeQty = options?.includeQty !== false;
  const uniqueParts = Array.from(
    new Set(
      (partNumbers || [])
        .map((value) => normalizeWcpSku(value))
        .filter(Boolean)
    )
  );
  if (!uniqueParts.length) return [];
  const baseLookups = await mapWithConcurrency(uniqueParts, 2, async (part) => {
    try {
      const details = await lookupWcpPart(part, {
        includeQty: false,
        useQueue: false
      });
      return { partNumber: part, ok: true, details };
    } catch (error) {
      return {
        partNumber: part,
        ok: false,
        error: error?.message || 'WCP lookup failed'
      };
    }
  });

  if (!includeQty) return baseLookups;

  const variantToPart = new Map();
  baseLookups.forEach((entry) => {
    if (!entry?.ok) return;
    const variantId = entry.details?.meta?.variantId;
    if (!variantId) return;
    variantToPart.set(String(variantId), entry.partNumber);
  });
  const qtySnapshots = await scrapeWcpQuantitiesViaCartBatch(
    Array.from(variantToPart.keys()),
    WCP_QTY_PROBE,
    20
  );

  return baseLookups.map((entry) => {
    if (!entry?.ok) return entry;
    const variantId = entry.details?.meta?.variantId;
    if (!variantId) return entry;
    const qtySnapshot = qtySnapshots.get(String(variantId));
    if (!qtySnapshot) return entry;
    const inStockQty = Number.isFinite(qtySnapshot.inStockQty)
      ? Math.max(0, Math.round(qtySnapshot.inStockQty))
      : null;
    const nextDetails = {
      ...entry.details,
      stock: {
        ...(entry.details?.stock || {}),
        inStockQty,
        quantitySource: 'wcp_cart_page',
        checkedAt: new Date().toISOString()
      },
      meta: {
        ...(entry.details?.meta || {}),
        stockInStockQty: inStockQty
      }
    };
    const statusKey = String(nextDetails.stock?.status || '').toLowerCase();
    const available = nextDetails.stock?.availableForSale;
    if (statusKey === 'in_stock' && available === true && Number.isFinite(inStockQty) && inStockQty <= 0) {
      nextDetails.stock.status = 'backordered';
      nextDetails.stock.label = wcpStockLabel('backordered');
      nextDetails.stock.statusSource = 'wcp_cart_page';
      nextDetails.meta.stockStatus = 'backordered';
      nextDetails.meta.stockLabel = wcpStockLabel('backordered');
    }
    storeWcpCacheEntry(entry.partNumber, nextDetails);
    return {
      ...entry,
      details: nextDetails
    };
  });
}

const AMAZON_ASIN_REGEX = /^[A-Z0-9]{10}$/i;

function normalizeAmazonAsin(value) {
  if (!value) return null;
  const trimmed = String(value).trim().toUpperCase();
  if (!AMAZON_ASIN_REGEX.test(trimmed)) return null;
  return trimmed;
}

function normalizeAmazonUrl(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function buildAmazonProductUrl(asin) {
  const normalized = normalizeAmazonAsin(asin);
  if (!normalized) return null;
  return `https://www.amazon.com/dp/${normalized}`;
}

function extractAmazonAsinFromUrl(rawUrl) {
  if (!rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(normalizeAmazonUrl(rawUrl));
  } catch (err) {
    return null;
  }
  const paramKeys = ['asin', 'ASIN', 'asin.0', 'asin.1', 'pd_rd_i'];
  for (const key of paramKeys) {
    const val = parsed.searchParams.get(key);
    const normalized = normalizeAmazonAsin(val);
    if (normalized) return normalized;
  }
  const path = parsed.pathname || '';
  const pathMatch = path.match(
    /(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing|exec\/obidos\/ASIN|o\/ASIN|product)\/([A-Z0-9]{10})(?:[/?]|$)/i
  );
  if (pathMatch) return normalizeAmazonAsin(pathMatch[1]);
  const segments = path.split('/').filter(Boolean);
  for (const segment of segments) {
    const normalized = normalizeAmazonAsin(segment);
    if (normalized) return normalized;
  }
  return null;
}

function extractAmazonAsinFromHtml(html) {
  if (!html) return null;
  const directMatches = [
    html.match(/data-asin="([A-Z0-9]{10})"/i),
    html.match(/"asin"\s*:\s*"([A-Z0-9]{10})"/i)
  ].filter(Boolean);
  for (const match of directMatches) {
    const normalized = normalizeAmazonAsin(match[1]);
    if (normalized) return normalized;
  }
  const $ = cheerio.load(html);
  const inputCandidates = [
    $('#ASIN').attr('value'),
    $('input[name="ASIN"]').attr('value'),
    $('input[name="ASIN.0"]').attr('value'),
    $('input[name="asin"]').attr('value'),
    $('input[id="ASIN"]').attr('value')
  ];
  for (const candidate of inputCandidates) {
    const normalized = normalizeAmazonAsin(candidate);
    if (normalized) return normalized;
  }
  const metaCandidates = [
    $('meta[name="ASIN"]').attr('content'),
    $('meta[property="og:asin"]').attr('content')
  ];
  for (const candidate of metaCandidates) {
    const normalized = normalizeAmazonAsin(candidate);
    if (normalized) return normalized;
  }
  const canonical =
    $('link[rel="canonical"]').attr('href') ||
    $('meta[property="og:url"]').attr('content');
  const fromCanonical = extractAmazonAsinFromUrl(canonical);
  if (fromCanonical) return fromCanonical;
  return null;
}

function pickAmazonText($, selectors) {
  for (const selector of selectors) {
    if (!selector) continue;
    const text = $(selector).first().text().trim();
    if (text) return text;
  }
  return '';
}

function pickAmazonAttr($, selectors, attr) {
  for (const selector of selectors) {
    if (!selector) continue;
    const value = $(selector).first().attr(attr);
    if (value) return String(value).trim();
  }
  return '';
}

function cleanAmazonTitle(title) {
  if (!title) return '';
  let cleaned = String(title).replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^Amazon\.com:\s*/i, '');
  cleaned = cleaned.replace(/\s*-\s*Amazon\.com$/i, '');
  cleaned = cleaned.replace(/\s*:\s*Amazon\.com$/i, '');
  return cleaned;
}

function extractAmazonTitle($) {
  const title = pickAmazonText($, [
    '#productTitle',
    '#title #productTitle',
    'span#productTitle',
    '#title',
    'h1 span#productTitle'
  ]);
  if (title) return cleanAmazonTitle(title);
  const metaTitle = pickAmazonAttr($, [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]'
  ], 'content');
  return cleanAmazonTitle(metaTitle);
}

function extractAmazonPrice($) {
  const metaPrice = pickAmazonAttr($, [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]'
  ], 'content');
  if (metaPrice) return metaPrice;
  const textPrice = pickAmazonText($, [
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#priceblock_saleprice',
    '#price_inside_buybox',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_mobile_feature_div .a-price .a-offscreen',
    '#apex_desktop_newAccordionRow .a-price .a-offscreen',
    '.a-price .a-offscreen'
  ]);
  if (textPrice) return textPrice;
  const whole = $('#corePriceDisplay_desktop_feature_div .a-price-whole')
    .first()
    .text()
    .trim();
  if (whole) {
    const fraction = $('#corePriceDisplay_desktop_feature_div .a-price-fraction')
      .first()
      .text()
      .trim();
    return fraction ? `${whole}.${fraction}` : whole;
  }
  return '';
}

function amazonRequestHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
  };
}

async function resolveAmazonProductUrl(rawUrl) {
  const normalized = normalizeAmazonUrl(rawUrl);
  let asin = extractAmazonAsinFromUrl(normalized);
  if (asin) {
    return {
      partNumber: asin,
      productUrl: buildAmazonProductUrl(asin) || normalized
    };
  }
  try {
    const resp = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      headers: amazonRequestHeaders()
    });
    const finalUrl = resp.url || normalized;
    asin = extractAmazonAsinFromUrl(finalUrl);
    let html = '';
    if (!asin) {
      html = await resp.text();
      asin = extractAmazonAsinFromHtml(html);
    }
    return {
      partNumber: asin,
      productUrl: buildAmazonProductUrl(asin) || finalUrl
    };
  } catch (error) {
    logger.warn(error, 'Failed to resolve Amazon URL');
    return { partNumber: null, productUrl: normalized };
  }
}

async function lookupAmazonPart(partNumber) {
  const asin = normalizeAmazonAsin(partNumber) || extractAmazonAsinFromUrl(partNumber);
  if (!asin) {
    throw new Error('ASIN is required for Amazon lookup.');
  }
  const targetUrl = buildAmazonProductUrl(asin);
  const resp = await fetch(targetUrl, {
    headers: amazonRequestHeaders()
  });
  if (!resp.ok) {
    throw new Error(`Amazon request failed (${resp.status}).`);
  }
  const html = await resp.text();
  const finalUrl = resp.url || targetUrl;
  const $ = cheerio.load(html);
  const parsedAsin =
    extractAmazonAsinFromHtml(html) ||
    extractAmazonAsinFromUrl(finalUrl) ||
    asin;
  const title = extractAmazonTitle($);
  const price = extractAmazonPrice($);
  const picks = {
    name: title || '',
    price: price || undefined
  };
  const meta = {
    asin: parsedAsin,
    partNumber: parsedAsin
  };
  const productUrl = buildAmazonProductUrl(parsedAsin) || finalUrl;
  if (!title && !price) {
    return {
      picks,
      productUrl,
      meta,
      message: 'Amazon page did not return product details.'
    };
  }
  return { picks, productUrl, meta };
}

const REV_ROBOTICS_SKU_REGEX = /^REV-[A-Z0-9-]+$/i;

function normalizeRevRoboticsSku(value) {
  if (!value) return null;
  const trimmed = String(value).trim().toUpperCase();
  if (!REV_ROBOTICS_SKU_REGEX.test(trimmed)) return null;
  return trimmed;
}

function normalizeRevRoboticsUrl(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function buildRevRoboticsProductUrl(sku) {
  const normalized = normalizeRevRoboticsSku(sku);
  if (!normalized) return null;
  return `https://www.revrobotics.com/${normalized}/`;
}

function cleanRevRoboticsTitle(title) {
  if (!title) return '';
  let cleaned = String(title).replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\s*-\s*REV Robotics$/i, '');
  cleaned = cleaned.replace(/\s*\|\s*REV Robotics$/i, '');
  return cleaned;
}

function extractRevRoboticsSkuFromUrl(rawUrl) {
  if (!rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(normalizeRevRoboticsUrl(rawUrl));
  } catch (err) {
    return null;
  }
  const searchKeys = ['search_query', 'search', 'sku', 'product'];
  for (const key of searchKeys) {
    const val = parsed.searchParams.get(key);
    const normalized = normalizeRevRoboticsSku(val);
    if (normalized) return normalized;
  }
  const parts = (parsed.pathname || '').split('/').filter(Boolean);
  for (const part of parts) {
    const normalized = normalizeRevRoboticsSku(part);
    if (normalized) return normalized;
  }
  return null;
}

function extractRevRoboticsSkuFromHtml(html) {
  if (!html) return null;
  const directMatch = html.match(/data-product-sku[^>]*>([^<]+)</i);
  if (directMatch) {
    const normalized = normalizeRevRoboticsSku(directMatch[1]);
    if (normalized) return normalized;
  }
  const $ = cheerio.load(html);
  const skuText =
    $('[data-product-sku]').first().text().trim() ||
    $('.productView-info-value--sku').first().text().trim() ||
    $('meta[itemprop="sku"]').attr('content');
  return normalizeRevRoboticsSku(skuText);
}

function pickRevRoboticsText($, selectors) {
  for (const selector of selectors) {
    if (!selector) continue;
    const text = $(selector).first().text().trim();
    if (text) return text;
  }
  return '';
}

function pickRevRoboticsAttr($, selectors, attr) {
  for (const selector of selectors) {
    if (!selector) continue;
    const value = $(selector).first().attr(attr);
    if (value) return String(value).trim();
  }
  return '';
}

function extractRevRoboticsTitle($) {
  const title = pickRevRoboticsText($, ['h1.productView-title', 'h1']);
  if (title) return cleanRevRoboticsTitle(title);
  const metaTitle = pickRevRoboticsAttr($, [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]'
  ], 'content');
  return cleanRevRoboticsTitle(metaTitle);
}

function extractRevRoboticsPrice($) {
  const metaPrice = pickRevRoboticsAttr($, [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]'
  ], 'content');
  if (metaPrice) return metaPrice;
  const priceText = pickRevRoboticsText($, [
    '[data-product-price-without-tax]',
    '.productView-price .price--main',
    '.price--withoutTax',
    '.price--main'
  ]);
  return priceText;
}

function extractRevRoboticsGraphQLToken(html) {
  if (!html) return null;
  const escapedMatch = html.match(/graphQLToken\\":\\"([^\\"]+)\\"/);
  if (escapedMatch?.[1]) return escapedMatch[1];
  const plainMatch = html.match(/graphQLToken":"([^"]+)"/);
  if (plainMatch?.[1]) return plainMatch[1];
  return null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanRevRoboticsVariantLabel(label, sku) {
  if (!label) return '';
  let cleaned = String(label).replace(/\s+/g, ' ').trim();
  if (sku) {
    const escaped = escapeRegex(sku);
    cleaned = cleaned.replace(new RegExp(`^\\(?${escaped}\\)?\\s*[-:]*\\s*`, 'i'), '');
  }
  return cleaned.trim();
}

function buildRevRoboticsVariantTitle(productName, labels, sku) {
  const baseName = productName ? cleanRevRoboticsTitle(productName) : '';
  const cleanedLabels = (labels || [])
    .map(label => cleanRevRoboticsVariantLabel(label, sku))
    .filter(Boolean);
  const uniqueLabels = [...new Set(cleanedLabels)];
  const labelText = uniqueLabels.join(' · ').trim();
  if (baseName && labelText) {
    if (!labelText.toLowerCase().includes(baseName.toLowerCase())) {
      return `${baseName} - ${labelText}`;
    }
    return labelText;
  }
  return labelText || baseName;
}

async function fetchRevRoboticsVariantDetails(sku, token) {
  if (!sku || !token) return null;
  const query = `query RevSkuLookup {
    site {
      product(sku: "${sku}") {
        name
        path
        variants(first: 100) {
          edges {
            node {
              sku
              prices { price { value currencyCode } }
              options {
                edges {
                  node {
                    values { edges { node { label } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;
  try {
    const resp = await fetch('https://www.revrobotics.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query })
    });
    const data = await resp.json();
    if (!resp.ok || data?.errors?.length) {
      logger.warn({ status: resp.status, errors: data?.errors }, 'REV Robotics GraphQL lookup failed');
      return null;
    }
    const product = data?.data?.site?.product;
    if (!product) return null;
    const variants = (product.variants?.edges || []).map(edge => edge?.node).filter(Boolean);
    const match = variants.find(node => (node?.sku || '').toUpperCase() === sku);
    const optionLabels = [];
    if (match?.options?.edges?.length) {
      match.options.edges.forEach(edge => {
        const values = edge?.node?.values?.edges || [];
        values.forEach(valueEdge => {
          const label = valueEdge?.node?.label;
          if (label) optionLabels.push(label);
        });
      });
    }
    const priceValue = match?.prices?.price?.value;
    return {
      productName: product.name,
      productPath: product.path,
      optionLabels,
      priceValue
    };
  } catch (error) {
    logger.warn(error, 'REV Robotics GraphQL lookup failed');
    return null;
  }
}

function revRoboticsRequestHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
  };
}

function normalizeRevRoboticsLink(link) {
  if (!link) return null;
  const trimmed = String(link).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `https://www.revrobotics.com${trimmed}`;
  return `https://www.revrobotics.com/${trimmed.replace(/^\//, '')}`;
}

function extractRevRoboticsProductLinkFromSearch($, sku) {
  const desired = normalizeRevRoboticsSku(sku);
  const cards = $('.productGrid .product');
  for (const card of cards.toArray()) {
    const skuText = $(card).find('[data-test-info-type="sku"], .card-text--sku').text().trim();
    if (desired && skuText && skuText.toUpperCase() === desired) {
      const link = $(card).find('h3.card-title a').attr('href');
      if (link) return normalizeRevRoboticsLink(link);
    }
  }
  const firstLink =
    $('.productGrid h3.card-title a').first().attr('href') ||
    $('.productGrid a').first().attr('href');
  return normalizeRevRoboticsLink(firstLink);
}

async function resolveRevRoboticsProductUrl(rawUrl) {
  const normalized = normalizeRevRoboticsUrl(rawUrl);
  let sku = extractRevRoboticsSkuFromUrl(normalized);
  if (sku) {
    return {
      partNumber: sku,
      productUrl: normalized
    };
  }
  try {
    const resp = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      headers: revRoboticsRequestHeaders()
    });
    const finalUrl = resp.url || normalized;
    sku = extractRevRoboticsSkuFromUrl(finalUrl);
    let html = '';
    if (!sku) {
      html = await resp.text();
      sku = extractRevRoboticsSkuFromHtml(html);
    }
    return {
      partNumber: sku,
      productUrl: finalUrl
    };
  } catch (error) {
    logger.warn(error, 'Failed to resolve REV Robotics URL');
    return { partNumber: null, productUrl: normalized };
  }
}

async function lookupRevRoboticsPart(partNumber) {
  const sku = normalizeRevRoboticsSku(partNumber) || extractRevRoboticsSkuFromUrl(partNumber);
  if (!sku) {
    throw new Error('REV Robotics part number is required.');
  }
  const productUrl = buildRevRoboticsProductUrl(sku);
  let resp = await fetch(productUrl, {
    headers: revRoboticsRequestHeaders()
  });
  if (!resp.ok) {
    const searchUrl = `https://www.revrobotics.com/search.php?search_query=${encodeURIComponent(sku)}`;
    const searchResp = await fetch(searchUrl, {
      headers: revRoboticsRequestHeaders()
    });
    if (!searchResp.ok) {
      throw new Error(`REV Robotics request failed (${resp.status}).`);
    }
    const searchHtml = await searchResp.text();
    const $search = cheerio.load(searchHtml);
    const link = extractRevRoboticsProductLinkFromSearch($search, sku);
    if (!link) {
      return {
        picks: {},
        productUrl: searchUrl,
        meta: { sku, partNumber: sku },
        message: 'No REV Robotics results found for that part number.'
      };
    }
    resp = await fetch(link, { headers: revRoboticsRequestHeaders() });
    if (!resp.ok) {
      throw new Error(`REV Robotics request failed (${resp.status}).`);
    }
  }
  const html = await resp.text();
  const finalUrl = resp.url || productUrl;
  const $ = cheerio.load(html);
  let title = extractRevRoboticsTitle($);
  let price = extractRevRoboticsPrice($);
  const pageSku = extractRevRoboticsSkuFromHtml(html) || sku;
  const token = extractRevRoboticsGraphQLToken(html);
  const variantDetails = await fetchRevRoboticsVariantDetails(sku, token);
  const variantTitle = buildRevRoboticsVariantTitle(
    variantDetails?.productName,
    variantDetails?.optionLabels,
    sku
  );
  if (variantTitle) title = variantTitle;
  if (variantDetails?.priceValue !== undefined && variantDetails.priceValue !== null) {
    const priceNum = Number(variantDetails.priceValue);
    if (Number.isFinite(priceNum)) price = priceNum.toFixed(2);
  }
  const graphPath = variantDetails?.productPath;
  const graphUrl = graphPath ? `https://www.revrobotics.com${graphPath}` : null;
  const resolvedUrl = graphUrl || finalUrl;
  const picks = {
    name: title || '',
    price: price || undefined
  };
  const meta = {
    sku: pageSku,
    partNumber: pageSku,
    productName: variantDetails?.productName || undefined
  };
  if (!title && !price) {
    return {
      picks,
      productUrl: resolvedUrl,
      meta,
      message: 'REV Robotics page did not return product details.'
    };
  }
  return { picks, productUrl: resolvedUrl, meta };
}

function extractShareACartId(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = (url.hostname || '').toLowerCase();
    if (host.includes('share-a-cart.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length) {
        const prefix = parts[0].toLowerCase();
        if (['get', 'receive', 'embed', 'review'].includes(prefix)) {
          if (parts[1]) return parts[1];
        } else if (parts.length === 1) {
          return parts[0];
        }
      }
      const queryId =
        url.searchParams.get('cartId') ||
        url.searchParams.get('cartid') ||
        url.searchParams.get('id') ||
        url.searchParams.get('cart');
      if (queryId) return queryId.trim();
    }
  } catch (err) {
    // Not a URL; fall back to treating input as a cart ID.
  }
  return raw.replace(/\s+/g, '') || null;
}

function pickShareACartValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function parseShareACartPrice(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseShareACartQuantity(value) {
  if (value === undefined || value === null) return 1;
  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.round(parsed));
}

function findShareACartItems(payload) {
  const candidates = [
    payload?.items,
    payload?.cartItems,
    payload?.cart?.items,
    payload?.cart?.cartItems,
    payload?.cart?.cart?.items,
    payload?.cart?.cart?.cartItems
  ];
  const isLikelyItem = item =>
    item &&
    typeof item === 'object' &&
    (item.asin ||
      item.sku ||
      item.productId ||
      item.title ||
      item.name ||
      item.quantity ||
      item.qty);
  for (const list of candidates) {
    if (Array.isArray(list) && list.some(isLikelyItem)) return list;
  }
  for (const value of Object.values(payload || {})) {
    if (Array.isArray(value) && value.some(isLikelyItem)) return value;
  }
  return [];
}

function normalizeShareACartItem(item, vendorName, cartId) {
  if (!item || typeof item !== 'object') return null;
  const productCode = pickShareACartValue(item, [
    'asin',
    'sku',
    'productId',
    'itemId',
    'id',
    'variantId',
    'offerId'
  ]);
  const description =
    pickShareACartValue(item, [
      'title',
      'name',
      'productName',
      'itemName',
      'itemTitle',
      'description',
      'displayName'
    ]) ||
    productCode ||
    'Cart item';
  const productUrl = pickShareACartValue(item, [
    'url',
    'link',
    'productUrl',
    'href',
    'detailPageUrl',
    'productLink',
    'canonicalUrl'
  ]);
  const unitPrice = parseShareACartPrice(
    pickShareACartValue(item, [
      'unitPrice',
      'price',
      'priceValue',
      'unitPriceValue',
      'itemPrice',
      'cost'
    ])
  );
  const quantity = parseShareACartQuantity(
    pickShareACartValue(item, [
      'quantity',
      'qty',
      'count',
      'cartQty',
      'cartQuantity',
      'quantityOrdered'
    ])
  );
  return {
    vendorKey: 'shareacart',
    vendorName,
    quantity,
    productCode: productCode || undefined,
    manufacturerPartNumber: productCode || undefined,
    description,
    productUrl,
    unitPrice,
    shareACartId: cartId,
    source: 'share-a-cart'
  };
}

app.post('/api/vendors/shareacart', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const input = req.body?.input || req.body?.cartId || req.body?.url || '';
  const cartId = extractShareACartId(input);
  if (!cartId) {
    return res.status(400).json({ error: 'Share-A-Cart link or cart ID is required.' });
  }
  try {
    const endpoint = `https://share-a-cart.com/api/get/r/cart/${encodeURIComponent(cartId)}`;
    const resp = await fetch(endpoint, {
      headers: { Accept: 'application/json', 'User-Agent': 'inventoryapp/1.0' }
    });
    const data = await resp.json();
    if (!resp.ok || data?.error) {
      throw new Error(data?.error || `Share-A-Cart request failed (${resp.status}).`);
    }
    const vendorName =
      data?.vendorDisplayName || data?.vendor || data?.store || data?.cartVendor || 'Share-A-Cart';
    const items = findShareACartItems(data);
    const entries = items
      .map(item => normalizeShareACartItem(item, vendorName, cartId))
      .filter(Boolean);
    if (!entries.length) {
      return res.status(400).json({ error: 'No items found in the Share-A-Cart cart.' });
    }
    const itemCount = Number.isFinite(Number(data?.cartTotalQty))
      ? Number(data.cartTotalQty)
      : entries.length;
    res.json({
      cartId,
      vendorName,
      entries,
      itemCount,
      cartTotalQty: data?.cartTotalQty,
      cartTotalPrice: data?.cartTotalPrice,
      cartCurrency: data?.cartCCY
    });
  } catch (error) {
    logger.error(error, 'Share-A-Cart import failed');
    res.status(500).json({ error: error.message || 'Share-A-Cart import failed.' });
  }
});

app.post('/api/vendors/extract/batch', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const vendorKey = typeof req.body?.vendorKey === 'string' ? req.body.vendorKey.toLowerCase() : '';
  const rawPartNumbers = Array.isArray(req.body?.partNumbers) ? req.body.partNumbers : [];
  if (!vendorKey) return res.status(400).json({ error: 'vendorKey is required' });
  if (!rawPartNumbers.length) return res.status(400).json({ error: 'partNumbers must be a non-empty array' });
  const def = getBuiltinVendor(vendorKey);
  if (!def) return res.status(404).json({ error: 'Unknown vendor integration' });
  if (def.key !== 'wcp') {
    return res.status(400).json({ error: 'Batch extract currently supports WCP only.' });
  }
  const includeQty = req.body?.includeQty === undefined ? true : parseBoolean(req.body.includeQty);
  const partNumbers = rawPartNumbers
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, 250);
  if (!partNumbers.length) return res.status(400).json({ error: 'No valid part numbers supplied' });
  try {
    const results = await lookupWcpPartsBatch(partNumbers, { includeQty });
    return res.json({
      vendor: def.vendor,
      vendorKey: def.key,
      count: results.length,
      results
    });
  } catch (error) {
    logger.error(error, `Failed built-in vendor batch lookup ${vendorKey}`);
    return res.status(500).json({ error: error?.message || 'Vendor batch lookup failed' });
  }
});

app.post('/api/vendors/wcp/stock/batch', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const rawVariantIds = Array.isArray(req.body?.variantIds) ? req.body.variantIds : [];
  if (!rawVariantIds.length) {
    return res.status(400).json({ error: 'variantIds must be a non-empty array' });
  }
  const variantIds = Array.from(
    new Set(
      rawVariantIds
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 250);
  if (!variantIds.length) {
    return res.status(400).json({ error: 'No valid variantIds supplied' });
  }
  try {
    const requestedQty = Number.isFinite(Number(req.body?.requestedQty))
      ? Math.max(1, Math.round(Number(req.body.requestedQty)))
      : WCP_QTY_PROBE;
    const chunkSize = Number.isFinite(Number(req.body?.chunkSize))
      ? Math.max(1, Math.round(Number(req.body.chunkSize)))
      : 20;
    const snapshots = await scrapeWcpQuantitiesViaCartBatch(variantIds, requestedQty, chunkSize);
    const checkedAt = Date.now();
    const results = variantIds.map((variantId) => {
      const snapshot = snapshots.get(String(variantId));
      return {
        variantId: String(variantId),
        inStockQty: Number.isFinite(Number(snapshot?.inStockQty))
          ? Math.max(0, Math.round(Number(snapshot.inStockQty)))
          : null,
        requestedQty,
        rawMessage: snapshot?.rawMessage || null,
        quantitySource: snapshot ? 'wcp_cart_page' : null,
        checkedAt
      };
    });
    return res.json({
      vendor: 'WCP',
      vendorKey: 'wcp',
      count: results.length,
      results
    });
  } catch (error) {
    logger.error(error, 'WCP variant stock batch lookup failed');
    return res.status(500).json({ error: error?.message || 'WCP variant stock lookup failed' });
  }
});

app.post('/api/vendors/extract', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const { url, selectors = {}, headers = {}, vendorKey, partNumber } = req.body || {};
  const builtinKey = typeof vendorKey === 'string' ? vendorKey.toLowerCase() : null;
  if (builtinKey) {
    const def = getBuiltinVendor(builtinKey);
    if (!def) return res.status(404).json({ error: 'Unknown vendor integration' });
    try {
      const settingsRecord = await client.query('vendorIntegrations:get', { vendorKey: def.key });
      const settings = settingsRecord?.settings || {};
      if (def.key === 'digikey') {
        if (!partNumber) {
          return res.status(400).json({ error: 'partNumber is required for Digi-Key lookup' });
        }
        const result = await digikeyService.lookupPart(partNumber, settings);
        return res.json({
          ...result,
          vendor: def.vendor,
          vendorKey: def.key
        });
      }
      if (def.key === 'mouser') {
        if (!partNumber) {
          return res.status(400).json({ error: 'partNumber is required for Mouser lookup' });
        }
        const result = await mouserService.lookupPart(partNumber, settings);
        return res.json({
          ...result,
          vendor: def.vendor,
          vendorKey: def.key
        });
      }
      if (def.key === 'amazon') {
        if (!partNumber) {
          return res.status(400).json({ error: 'partNumber is required for Amazon lookup' });
        }
        const result = await lookupAmazonPart(partNumber);
        return res.json({
          ...result,
          vendor: def.vendor,
          vendorKey: def.key
        });
      }
      if (def.key === 'revrobotics') {
        if (!partNumber) {
          return res.status(400).json({ error: 'partNumber is required for REV Robotics lookup' });
        }
        const result = await lookupRevRoboticsPart(partNumber);
        return res.json({
          ...result,
          vendor: def.vendor,
          vendorKey: def.key
        });
      }
      if (def.key === 'wcp') {
        if (!partNumber) {
          return res.status(400).json({ error: 'partNumber is required for WCP lookup' });
        }
        const details = await lookupWcpPart(partNumber);
        return res.json({
          ...details,
          vendor: def.vendor,
          vendorKey: def.key
        });
      }
      return res.status(501).json({ error: `Integration for ${def.vendor} is not implemented yet.` });
    } catch (error) {
      logger.error(error, `Failed built-in vendor lookup ${builtinKey}`);
      const message = error?.message || 'Vendor integration failed';
      if (builtinKey === 'wcp' && /\(429\)/.test(message)) {
        return res.status(503).json({ error: 'WCP returned HTTP 429 to the server request (often anti-bot protection). Please retry shortly.' });
      }
      return res.status(500).json({ error: message });
    }
  }
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const { picks, candidates, shopify } = await extractVendorProductFromUrl({
      url,
      selectors,
      headers
    });
    res.json({ picks, candidates, shopify });
  } catch (error) {
    logger.error(error, 'Failed to extract vendor product');
    res.status(500).json({ error: 'Extraction failed', details: error.message });
  }
});

app.use((err, req, res, next) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

ensureAdminSeed().finally(() => {
  syncGoogleCredentialsFromStore().catch(err => logger.warn(err, 'Failed to load Google credentials on startup'));
  trackingService.init().catch(err => logger.error(err, 'Failed to start tracking service'));
  stockStatusService.init().catch(err => logger.error(err, 'Failed to start WCP stock service'));
  app.listen(config.port, () => {
    logger.info(`Inventory app server (Convex-backed) listening on port ${config.port}`);
  });
});
