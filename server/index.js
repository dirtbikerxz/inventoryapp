const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const path = require('path');
const pino = require('pino');
const { ConvexHttpClient } = require('convex/browser');

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
  convexUrl: process.env.CONVEX_URL
};

if (!config.convexUrl) {
  throw new Error('CONVEX_URL is required to talk to Convex backend.');
}

const client = new ConvexHttpClient(config.convexUrl);
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), convexUrl: config.convexUrl });
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

app.get('/api/orders', async (req, res) => {
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
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Order payload is required' });
  }

  try {
    const result = await client.mutation('orders:create', req.body);
    res.status(201).json({ order: result });
  } catch (error) {
    logger.error(error, 'Failed to create order');
    res.status(500).json({ error: 'Unable to create order' });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { status, trackingNumber } = req.body || {};
  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }
  try {
    const result = await client.mutation('orders:updateStatus', {
      orderId: req.params.id,
      status,
      trackingNumber
    });
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to update order status');
    res.status(500).json({ error: 'Unable to update order status' });
  }
});

app.patch('/api/orders/:id/group', async (req, res) => {
  const { groupId } = req.body || {};
  if (!groupId) {
    return res.status(400).json({ error: 'groupId is required' });
  }
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
  try {
    const groups = await client.query('orderGroups:list', {});
    res.json({ groups });
  } catch (error) {
    logger.error(error, 'Failed to load order groups');
    res.status(500).json({ error: 'Unable to load order groups' });
  }
});

app.post('/api/order-groups', async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'Group payload is required' });
  }
  try {
    const group = await client.mutation('orderGroups:create', req.body);
    res.status(201).json(group);
  } catch (error) {
    logger.error(error, 'Failed to create order group');
    res.status(500).json({ error: 'Unable to create order group' });
  }
});

app.patch('/api/order-groups/:id', async (req, res) => {
  try {
    const group = await client.mutation('orderGroups:update', {
      groupId: req.params.id,
      ...req.body
    });
    res.json(group);
  } catch (error) {
    logger.error(error, 'Failed to update order group');
    res.status(500).json({ error: 'Unable to update order group' });
  }
});

app.get('/api/students', async (req, res) => {
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

app.use((err, req, res, next) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  logger.info(`Inventory app server (Convex-backed) listening on port ${config.port}`);
});
