const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SQLiteStore = SQLiteStoreFactory(session);
const db = new Database(path.join(__dirname, 'shopqa.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Database schema. Prices are stored in paise to avoid floating-point rounding.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  compare_at_price INTEGER,
  image_url TEXT NOT NULL,
  badge TEXT,
  stock INTEGER NOT NULL DEFAULT 20 CHECK(stock >= 0),
  rating REAL NOT NULL DEFAULT 4.6,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  UNIQUE(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Confirmed',
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  tax INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  shipping_name TEXT NOT NULL,
  shipping_email TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);
`);

const seedProducts = [
  ['Aero Wireless Headphones','aero-wireless-headphones','Immersive sound, all-day comfort, and a beautifully minimal silhouette.','Audio',129900,159900,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=85','BESTSELLER',24,4.9],
  ['Form Everyday Backpack','form-everyday-backpack','A considered carryall with smart compartments and weather-resistant fabric.','Carry',84900,99900,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85','NEW ARRIVAL',18,4.8],
  ['Studio Ceramic Set','studio-ceramic-set','A tactile set of stoneware essentials made for slow mornings and long dinners.','Living',42900,null,'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1000&q=85',null,31,4.7],
  ['Orbit Smart Watch','orbit-smart-watch','Thoughtful health insights, precise tracking, and a battery that keeps up.','Tech',189900,219900,'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85','−14%',12,4.8],
  ['Luma Table Lamp','luma-table-lamp','Soft ambient lighting with a sculptural profile for any quiet corner.','Living',67900,null,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=85',null,15,4.6],
  ['Motion Everyday Sneakers','motion-everyday-sneakers','Lightweight cushioning and a versatile profile, from commute to weekend.','Wear',99900,119900,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85','POPULAR',20,4.7],
  ['Arc Minimal Bottle','arc-minimal-bottle','Double-wall insulation in a durable, understated stainless-steel finish.','Carry',24900,null,'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=85',null,42,4.5],
  ['Focus Desk Mat','focus-desk-mat','A smooth, generous workspace surface with a refined vegan-leather finish.','Tech',35900,null,'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=85',null,28,4.6]
];
const insertProduct = db.prepare(`INSERT OR IGNORE INTO products (name,slug,description,category,price,compare_at_price,image_url,badge,stock,rating) VALUES (?,?,?,?,?,?,?,?,?,?)`);
for (const p of seedProducts) insertProduct.run(...p);

// Seed demo accounts for repeatable local QA runs. Never use these credentials in a public deployment.
const demoEmail = 'qa.demo@shopqa.test';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail)) {
  db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run('QA Demo User', demoEmail, bcrypt.hashSync('ShopQA@123', 10), 'customer');
}
const adminEmail = 'qa.admin@shopqa.test';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
  db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run('QA Demo Admin', adminEmail, bcrypt.hashSync('ShopQAAdmin@123', 10), 'admin');
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: __dirname }),
  secret: process.env.SESSION_SECRET || 'local-shopqa-session-secret-change-before-deploy',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const safeUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const requireAuth = (req, res, next) => req.session.userId ? next() : res.status(401).json({ error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' });
const productDto = p => ({ ...p, price: p.price / 100, compare_at_price: p.compare_at_price == null ? null : p.compare_at_price / 100 });
const getCart = userId => db.prepare(`SELECT p.id AS product_id,p.name,p.slug,p.image_url,p.stock,p.price,c.quantity,(p.price*c.quantity) AS line_total FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=? AND p.active=1 ORDER BY c.id DESC`).all(userId).map(x => ({ ...x, price: x.price / 100, line_total: x.line_total / 100 }));
const money = n => Math.round(n * 100);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'ShopQA API', timestamp: new Date().toISOString() }));
app.get('/api/products', (req, res) => {
  const { q = '', category = 'All', sort = 'featured' } = req.query;
  let rows = db.prepare('SELECT * FROM products WHERE active=1').all();
  const term = String(q).trim().toLowerCase();
  if (term) rows = rows.filter(p => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(term));
  if (category !== 'All') rows = rows.filter(p => p.category === category);
  if (sort === 'price-asc') rows.sort((a,b) => a.price-b.price);
  if (sort === 'price-desc') rows.sort((a,b) => b.price-a.price);
  if (sort === 'rating') rows.sort((a,b) => b.rating-a.rating);
  res.json({ products: rows.map(productDto), total: rows.length });
});
app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: productDto(p) });
});

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || name.length > 70) return res.status(400).json({ error: 'Name must contain 2–70 characters.', field: 'name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must contain 8–72 characters.', field: 'password' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
  const result = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(name, email, bcrypt.hashSync(password, 10));
  req.session.userId = Number(result.lastInsertRowid);
  res.status(201).json({ user: safeUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId)) });
});
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
  req.session.userId = user.id;
  res.json({ user: safeUser(user) });
});
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ message: 'Signed out successfully.' }); }));
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  res.json({ user: user ? safeUser(user) : null });
});

app.get('/api/cart', requireAuth, (req, res) => {
  const items = getCart(req.session.userId);
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  res.json({ items, subtotal, count: items.reduce((s,i) => s+i.quantity,0) });
});
app.post('/api/cart', requireAuth, (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Number(req.body.quantity ?? 1);
  if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return res.status(400).json({ error: 'Choose a quantity between 1 and 10.' });
  const p = db.prepare('SELECT id,stock FROM products WHERE id=? AND active=1').get(productId);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const existing = db.prepare('SELECT quantity FROM cart_items WHERE user_id=? AND product_id=?').get(req.session.userId, productId);
  const nextQty = (existing?.quantity || 0) + quantity;
  if (nextQty > Math.min(p.stock, 10)) return res.status(409).json({ error: `Only ${Math.min(p.stock,10)} unit(s) can be added to the cart.`, code: 'INSUFFICIENT_STOCK' });
  db.prepare(`INSERT INTO cart_items (user_id,product_id,quantity) VALUES (?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity`).run(req.session.userId, productId, nextQty);
  res.status(201).json({ items: getCart(req.session.userId), message: 'Added to cart.' });
});
app.patch('/api/cart/:productId', requireAuth, (req, res) => {
  const id = Number(req.params.productId), quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return res.status(400).json({ error: 'Quantity must be between 1 and 10.' });
  const p = db.prepare('SELECT stock FROM products WHERE id=? AND active=1').get(id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  if (quantity > p.stock) return res.status(409).json({ error: 'Requested quantity exceeds available stock.' });
  const result = db.prepare('UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=?').run(quantity, req.session.userId, id);
  if (!result.changes) return res.status(404).json({ error: 'Item is not in your cart.' });
  res.json({ items: getCart(req.session.userId) });
});
app.delete('/api/cart/:productId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id=? AND product_id=?').run(req.session.userId, Number(req.params.productId));
  res.json({ items: getCart(req.session.userId), message: 'Item removed.' });
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { shippingName, email, address, city, postalCode, paymentMethod } = req.body || {};
  const fields = { shippingName, email, address, city, postalCode };
  for (const [key,value] of Object.entries(fields)) {
    if (typeof value !== 'string' || !value.trim()) return res.status(400).json({ error: 'Please complete all required shipping fields.', field: key });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  if (!/^[A-Za-z0-9 -]{4,10}$/.test(postalCode.trim())) return res.status(400).json({ error: 'Enter a valid postal code.', field: 'postalCode' });
  if (!['card','upi','cod'].includes(paymentMethod)) return res.status(400).json({ error: 'Select a supported payment method.', field: 'paymentMethod' });
  const items = getCart(req.session.userId);
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.', code: 'EMPTY_CART' });
  for (const item of items) {
    const p = db.prepare('SELECT stock FROM products WHERE id=?').get(item.product_id);
    if (!p || p.stock < item.quantity) return res.status(409).json({ error: `${item.name} no longer has enough stock.`, code: 'STOCK_CHANGED' });
  }
  const subtotal = items.reduce((s,i) => s + money(i.line_total), 0);
  const shipping = subtotal >= 150000 ? 0 : 9900;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + shipping + tax;
  const orderNumber = `SQ-${Date.now().toString().slice(-8)}-${Math.floor(Math.random()*90+10)}`;
  const createOrder = db.transaction(() => {
    const orderId = db.prepare(`INSERT INTO orders (order_number,user_id,subtotal,shipping,tax,total,payment_method,shipping_name,shipping_email,address,city,postal_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(orderNumber, req.session.userId, subtotal, shipping, tax, total, paymentMethod, shippingName.trim(), email.trim().toLowerCase(), address.trim(), city.trim(), postalCode.trim()).lastInsertRowid;
    for (const item of items) {
      db.prepare('INSERT INTO order_items (order_id,product_id,product_name,unit_price,quantity) VALUES (?,?,?,?,?)').run(orderId,item.product_id,item.name,money(item.price),item.quantity);
      db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(item.quantity,item.product_id);
    }
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.session.userId);
    return Number(orderId);
  });
  const orderId = createOrder();
  res.status(201).json({ order: db.prepare('SELECT id,order_number,status,subtotal,shipping,tax,total,payment_method,created_at FROM orders WHERE id=?').get(orderId) });
});
app.get('/api/orders', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT id,order_number,status,subtotal,shipping,tax,total,payment_method,created_at FROM orders WHERE user_id=? ORDER BY id DESC').all(req.session.userId)
    .map(o => ({ ...o, subtotal:o.subtotal/100, shipping:o.shipping/100, tax:o.tax/100, total:o.total/100 }));
  res.json({ orders });
});
app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(Number(req.params.id),req.session.userId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const items = db.prepare('SELECT product_id,product_name,unit_price,quantity FROM order_items WHERE order_id=?').all(order.id).map(i=>({...i,unit_price:i.unit_price/100,line_total:i.unit_price*i.quantity/100}));
  res.json({ order: { ...order, subtotal:order.subtotal/100, shipping:order.shipping/100, tax:order.tax/100, total:order.total/100 }, items });
});

// Admin QA endpoint for inventory inspection. Restricted to a seeded demo admin account.
app.get('/api/admin/products', requireAuth, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  res.json({ products: db.prepare('SELECT id,name,category,price,stock,active FROM products ORDER BY id').all().map(productDto) });
});
app.get('/api/admin/orders', requireAuth, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  const orders = db.prepare('SELECT id,order_number,user_id,status,total,payment_method,created_at FROM orders ORDER BY id DESC').all()
    .map(o => ({ ...o, total: o.total / 100 }));
  res.json({ orders });
});
app.patch('/api/admin/orders/:id/status', requireAuth, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  const status = String(req.body.status || '');
  if (!['Confirmed','Processing','Shipped','Delivered','Cancelled'].includes(status)) return res.status(400).json({ error: 'Unsupported order status.' });
  const result = db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Order not found.' });
  res.json({ message: 'Order status updated.', id: Number(req.params.id), status });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => console.log(`ShopQA is running at http://localhost:${PORT}`));
