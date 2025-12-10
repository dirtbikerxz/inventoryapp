const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const pino = require('pino');
const { ConvexHttpClient } = require('convex/browser');
const { TrackingService, buildTrackingUrl } = require('./trackingService');

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

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function defaultPermissions(role) {
  const base = {
    canPlaceOrders: true,
    canMoveOrders: false,
    canEditOrders: false,
    canDeleteOrders: false,
    canManageVendors: false,
    canManageUsers: false,
    canManageTags: false,
    canEditInventoryCatalog: false,
    canManageStock: false,
    canEditStock: false
  };
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return {
        canPlaceOrders: true,
        canMoveOrders: true,
        canEditOrders: true,
        canDeleteOrders: true,
        canManageVendors: true,
        canManageUsers: true,
        canManageTags: true,
        canEditInventoryCatalog: true,
        canManageStock: true,
        canEditStock: true
      };
    case 'mentor':
      return {
        canPlaceOrders: true,
        canMoveOrders: true,
        canEditOrders: true,
        canDeleteOrders: true,
        canManageVendors: true,
        canManageUsers: false,
        canManageTags: true,
        canEditInventoryCatalog: true,
        canManageStock: true,
        canEditStock: true
      };
    case 'student':
      return base;
    default:
      return base;
  }
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
      includeArchived: req.query.includeArchived === 'true'
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
  const { catalogItemId, subteamId, quantityOnHand, lowStockThreshold, location, category, notes } = req.body || {};
  if (!catalogItemId || quantityOnHand === undefined) {
    return res.status(400).json({ error: 'catalogItemId and quantityOnHand are required' });
  }
  try {
    const result = await client.mutation('stock:create', {
      catalogItemId,
      subteamId,
      quantityOnHand,
      lowStockThreshold,
      location,
      category,
      notes,
      userId: user._id?.toString()
    });
    res.status(201).json(result);
  } catch (error) {
    logger.error(error, 'Failed to create stock item');
    res.status(500).json({ error: 'Unable to create stock item', details: error.message });
  }
});

app.patch('/api/stock/:id', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageStock');
  if (!user) return;
  const { subteamId, lowStockThreshold, location, category, notes, quantityOnHand } = req.body || {};
  try {
    const result = await client.mutation('stock:update', {
      id: req.params.id,
      subteamId,
      lowStockThreshold,
      location,
      category,
      notes,
      quantityOnHand,
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
  const { delta, quantityOnHand } = req.body || {};
  try {
    const result = await client.mutation('stock:adjustQuantity', {
      id: req.params.id,
      delta,
      quantityOnHand,
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
    res.json(data);
  } catch (error) {
    logger.error(error, 'Failed to load orders');
    res.status(500).json({ error: 'Unable to load orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  const user = await requireAuth(req, res, 'canPlaceOrders');
  if (!user) return;
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Order payload is required' });
  }

  try {
    const tracking = normalizeTrackingPayload(req.body.tracking, req.body.trackingNumber, req.body.carrier);
    const isPrivileged = ['admin','mentor'].includes((user.role || '').toLowerCase()) || user.permissions?.canEditOrders;
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
  const user = await requireAuth(req, res, 'canEditOrders');
  if (!user) return;
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
  const user = await requireAuth(req, res, 'canDeleteOrders');
  if (!user) return;
  try {
    await client.mutation('orders:deleteOrder', { orderId: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to delete order');
    res.status(500).json({ error: 'Unable to delete order' });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const user = await requireAuth(req, res, 'canMoveOrders');
  if (!user) return;
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
  const user = await requireAuth(req, res, 'canEditOrders');
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
  const user = await requireAuth(req, res, 'canMoveOrders');
  if (!user) return;
  const { groupId } = req.body || {};
  try {
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
  const user = await requireAuth(req, res, 'canMoveOrders');
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
  const user = await requireAuth(req, res, 'canMoveOrders');
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
  const user = await requireAuth(req, res, 'canDeleteOrders');
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
    const vendors = await client.query('vendors:list', {});
    res.json({ vendors });
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

app.get('/api/tracking/settings', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  try {
    const settings = await client.query('tracking:getSettings', {});
    res.json({ settings });
  } catch (error) {
    logger.error(error, 'Failed to load tracking settings');
    res.status(500).json({ error: 'Unable to load tracking settings' });
  }
});

app.patch('/api/tracking/settings', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  const refreshMinutes = Number(req.body?.refreshMinutes ?? 30);
  if (!Number.isFinite(refreshMinutes) || refreshMinutes <= 0) {
    return res.status(400).json({ error: 'refreshMinutes must be a positive number' });
  }
  try {
    await trackingService.updateSettings({
      upsClientId: req.body?.upsClientId,
      upsClientSecret: req.body?.upsClientSecret,
      uspsUserId: req.body?.uspsUserId,
      fedexClientId: req.body?.fedexClientId,
      fedexClientSecret: req.body?.fedexClientSecret,
      refreshMinutes
    });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to save tracking settings');
    res.status(500).json({ error: 'Unable to save tracking settings' });
  }
});

app.post('/api/tracking/refresh', async (req, res) => {
  const user = await requireAuth(req, res, 'canManageUsers');
  if (!user) return;
  try {
    const result = await trackingService.refreshAllNow();
    res.json({ ok: true, lastError: result.lastError });
  } catch (error) {
    logger.error(error, 'Manual tracking refresh failed');
    res.status(500).json({ error: 'Unable to refresh tracking now' });
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

app.post('/api/vendors/extract', async (req, res) => {
  const user = await requireAuth(req, res, null);
  if (!user) return;
  const { url, selectors = {}, headers = {} } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
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
      shopifyVariant = shopifyMeta.variants.find(v => String(v.id) === String(variantId)) || shopifyMeta.variants[0];
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
    res.json({ picks, candidates, shopify: shopifyMeta ? { vendor: shopifyMeta.vendor, variant: shopifyVariant, variants: shopifyMeta.variants } : null });
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
  trackingService.init().catch(err => logger.error(err, 'Failed to start tracking service'));
  app.listen(config.port, () => {
    logger.info(`Inventory app server (Convex-backed) listening on port ${config.port}`);
  });
});
