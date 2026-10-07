/**
 * MotoGari — Honda CG70 & CG125 spare-parts store (Pakistan)
 * Node.js + Express + JSON file database. No build step, no external DB.
 * Built by ZN DEVELOPER — CEO Zain Hanif
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DATA_DIR = path.join(ROOT, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const imageCache = new Map();

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
migrateOrders();

app.use(express.json({ limit: '64kb' }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use('/assets', express.static(ASSETS_DIR, { maxAge: '1d' }));

/* ------------------------------------------------------------------ db */
function readJSON(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (err) {
    console.error('[db] could not read', file, err.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function getProducts() {
  const list = readJSON(PRODUCTS_FILE, []);
  if (!Array.isArray(list)) return [];
  return list.map((p) => {
    const out = resolveImage(p);
    if (!out.sku) out.sku = out.partNumber || out.brand || '';
    return out;
  });
}

function resolveImage(p) {
  if (!p || !p.image) return p;
  const base = String(p.image);
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(base)) {
    return Object.assign({}, p, { image: '/assets/products/' + base.replace(/^\/+/, '') });
  }
  const key = base.replace(/[^a-z0-9_-]/gi, '');
  if (imageCache.has(key)) return Object.assign({}, p, { image: imageCache.get(key) });
  let found = '/assets/img/parts-placeholder.svg';
  for (const ext of IMAGE_EXTS) {
    const candidate = path.join(ASSETS_DIR, 'products', key + ext);
    if (fs.existsSync(candidate)) {
      found = '/assets/products/' + key + ext;
      break;
    }
  }
  imageCache.set(key, found);
  return Object.assign({}, p, { image: found });
}

function getOrders() {
  const raw = readJSON(ORDERS_FILE, []);
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.orders) ? raw.orders : [];
  return list.map((o) => {
    if (!o.id && o.orderId) o.id = o.orderId;
    if (!o.orderId && o.id) o.orderId = o.id;
    return o;
  });
}

/** one-time migration: older builds stored {updatedAt, orders:[...]} */
function migrateOrders() {
  try {
    const raw = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    if (!Array.isArray(raw) && raw && Array.isArray(raw.orders)) {
      const list = raw.orders.map((o) => Object.assign({ id: o.orderId }, o, { orderId: o.orderId || o.id }));
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2), 'utf8');
      console.log('[db] migrated legacy orders file -> plain array (' + list.length + ' orders)');
    }
  } catch (err) {
    console.error('[db] orders migration skipped:', err.message);
  }
}

/* -------------------------------------------------------------- helpers */
function toNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function badRequest(res, message) {
  return res.status(400).json({ ok: false, error: message });
}

/* ----------------------------------------------------------- GET products */
app.get('/api/products', (req, res) => {
  let items = getProducts();
  const q = (req.query.search || req.query.q || '').toString().trim().toLowerCase();
  const model = (req.query.model || '').toString().trim().toUpperCase();
  const category = (req.query.category || '').toString().trim().toLowerCase();
  const min = toNum(req.query.min);
  const max = toNum(req.query.max);
  const sort = (req.query.sort || 'featured').toString().toLowerCase();

  if (q) {
    items = items.filter((p) =>
      [p.name, p.description, p.brand, p.partNumber, p.category, p.fits]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

  if (model) {
    if (model !== 'CG70' && model !== 'CG125') return badRequest(res, 'model must be CG70 or CG125');
    items = items.filter((p) => (p.models || []).includes(model));
  }

  if (category) {
    items = items.filter((p) => String(p.category || '').toLowerCase() === category);
  }

  if (min !== null) items = items.filter((p) => Number(p.price) >= min);
  if (max !== null) items = items.filter((p) => Number(p.price) <= max);

  const cmp = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    'featured': (a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name),
    'name': (a, b) => a.name.localeCompare(b.name),
    'newest': (a, b) => String(b.id).localeCompare(String(a.id))
  }[sort];

  if (!cmp) return badRequest(res, 'sort must be price-asc, price-desc, featured, name or newest');
  items.sort(cmp);

  res.json({ ok: true, count: items.length, items });
});

app.get('/api/products/:id', (req, res) => {
  const p = getProducts().find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ ok: false, error: 'product not found' });
  res.json({ ok: true, item: p });
});

app.get('/api/categories', (req, res) => {
  const items = getProducts();
  const map = new Map();
  for (const p of items) {
    const key = p.category || 'Other';
    const entry = map.get(key) || { name: key, count: 0, minPrice: Infinity, image: null };
    entry.count += 1;
    entry.minPrice = Math.min(entry.minPrice, p.price);
    if (!entry.image) entry.image = p.image;
    map.set(key, entry);
  }
  const list = [...map.values()].sort((a, b) => b.count - a.count);
  res.json(list);
});

app.get('/api/models', (req, res) => {
  const items = getProducts();
  const inModel = (id) => items.filter((p) => (p.models || []).includes(id)).length;
  const inBoth = items.filter((p) => (p.models || []).length > 1).length;
  res.json([
    { id: 'CG70', model: 'CG70', label: 'Honda CG70', count: inModel('CG70') },
    { id: 'CG125', model: 'CG125', label: 'Honda CG125', count: inModel('CG125') },
    { id: 'both', model: 'CG70 / CG125', label: 'Fits both models', count: inBoth }
  ]);
});

/* --------------------------------------------------------------- orders */
const PHONE_RE = /^(?:\+?92|0)?3\d{2}[-\s]?\d{7}$/;

function validateOrder(body) {
  if (!body || typeof body !== 'object') return { error: 'JSON body expected' };

  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 60) return { error: 'name must be 2-60 characters' };
  if (!/[\p{L}]/u.test(name)) return { error: 'name must contain letters' };

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!PHONE_RE.test(phone)) return { error: 'phone must be a valid Pakistani mobile number, e.g. 0300 1234567' };

  const city = typeof body.city === 'string' ? body.city.trim().replace(/\s+/g, ' ') : '';
  if (city.length < 2 || city.length > 50) return { error: 'city must be 2-50 characters' };

  const address = typeof body.address === 'string' ? body.address.trim().replace(/\s+/g, ' ') : '';
  if (address.length < 8 || address.length > 220) return { error: 'address must be 8-220 characters' };

  if (!Array.isArray(body.items) || body.items.length === 0) return { error: 'items must be a non-empty array' };
  if (body.items.length > 30) return { error: 'too many line items' };

  return { name, phone, city, address, items: body.items };
}

app.post('/api/orders', (req, res) => {
  const v = validateOrder(req.body);
  if (v.error) return badRequest(res, v.error);

  const catalogue = new Map(getProducts().map((p) => [p.id, p]));
  const lines = [];
  const seen = new Set();

  for (const raw of v.items) {
    if (!raw || typeof raw !== 'object') return badRequest(res, 'each item must be an object {id, qty}');
    const id = String(raw.id || '').trim();
    const qty = Number(raw.qty);
    if (!catalogue.has(id)) return badRequest(res, `unknown product id: ${id || '(empty)'}`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return badRequest(res, 'qty must be an integer between 1 and 99');
    if (seen.has(id)) return badRequest(res, `duplicate line item: ${id}`);
    seen.add(id);

    const p = catalogue.get(id);
    if (p.stock < qty) return badRequest(res, `only ${p.stock} in stock for ${p.name}`);

    lines.push({ id, qty, name: p.name, price: p.price, model: p.fits, category: p.category, image: p.image });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const shipping = subtotal >= 5000 ? 0 : 250;
  const total = subtotal + shipping;
  const itemsCount = lines.reduce((sum, l) => sum + l.qty, 0);

  const orders = getOrders();
  const order = {
    id: 'MG-' + Date.now().toString(36).toUpperCase() + '-' + String(orders.length + 1).padStart(3, '0'),
    createdAt: new Date().toISOString(),
    status: 'Pending confirmation',
    customer: { name: v.name, phone: v.phone, city: v.city, address: v.address },
    items: lines,
    itemsCount,
    subtotal,
    shipping,
    total,
    payment: 'Cash on Delivery (COD)',
    source: 'moto-gari web'
  };

  orders.push(order);
  try {
    writeJSON(ORDERS_FILE, orders);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'could not persist order: ' + err.message });
  }

  res.status(201).json({
    ok: true,
    orderId: order.id,
    total: order.total,
    subtotal: order.subtotal,
    shipping: order.shipping,
    itemsCount,
    payment: order.payment,
    message: `Order ${order.id} received. Our team will call ${order.customer.phone} to confirm before shipping.`
  });
});

/* ------------------------------------------------------------ admin/api */
app.get('/api/orders', (req, res) => {
  const orders = getOrders().slice().reverse();
  res.json({ ok: true, count: orders.length, orders, items: orders });
});

app.get('/api/stats', (req, res) => {
  const products = getProducts();
  const orders = getOrders();
  const categories = new Set(products.map((p) => p.category).filter(Boolean));
  const revenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  res.json({
    ok: true,
    products: products.length,
    orders: orders.length,
    categories: categories.size,
    models: 2,
    revenue
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), port: PORT }));

/* --------------------------------------------------------------- pages */
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/admin/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

/* ---------------------------------------------------------------- 404s */
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'not found' }));
app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ ok: false, error: 'method not allowed' });
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'), (err) => {
    if (err) res.status(404).type('text/plain').send('404 — page not found');
  });
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'invalid JSON body' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'payload too large' });
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`MotoGari running → http://localhost:${PORT}`);
  console.log(`Admin orders    → http://localhost:${PORT}/admin`);
});
