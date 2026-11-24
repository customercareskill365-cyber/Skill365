require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'skill365-dev-secret-key';

// Ensure media directories exist
['media/videos', 'media/live', 'media/products', 'data'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(path.join(__dirname, 'media')));

// In-memory store (backed by data/db.json for persistence across restarts)
const DB_FILE = path.join(__dirname, 'data/db.json');

function createSeedData() {
  const passwordHash = bcrypt.hashSync('Skill365@2026', 10);
  return {
    users: [
      { id: 1, name: 'Aarav Sharma', email: 'student@skill365.io', password: passwordHash, role: 'student', status: 'Active', enrolledIds: [1, 3], progress: { 1: 68, 3: 45 }, purchasedProductIds: [1], registeredLiveIds: [1] },
      { id: 2, name: 'Rohan Mehta', email: 'instructor@skill365.io', password: passwordHash, role: 'instructor', status: 'Active', enrolledIds: [], progress: {}, purchasedProductIds: [], registeredLiveIds: [] },
      { id: 3, name: 'Priya Nair', email: 'admin@skill365.io', password: passwordHash, role: 'admin', status: 'Active', enrolledIds: [], progress: {}, purchasedProductIds: [], registeredLiveIds: [] }
    ],
    courses: [
      { id: 1, title: 'Full-Stack Web Architecture', category: 'Development', instructor: 'Rohan Mehta', duration: '6h 40m', lessons: 18, videoUrl: '', description: 'Design scalable REST APIs, authentication flows, and modern responsive UIs from scratch.' },
      { id: 2, title: 'UI/UX Design Systems with CSS', category: 'Design', instructor: 'Ananya Verma', duration: '4h 15m', lessons: 12, videoUrl: '', description: 'Build cohesive component libraries, color tokens, and accessible responsive layouts.' },
      { id: 3, title: 'Applied AI & Prompt Engineering', category: 'Data & AI', instructor: 'Dr. Kabir Nair', duration: '5h 20m', lessons: 14, videoUrl: '', description: 'Integrate LLM workflows, structured outputs, and evaluation pipelines into real apps.' },
      { id: 4, title: 'Product Strategy & Growth Analytics', category: 'Business', instructor: 'Meera Kapoor', duration: '3h 50m', lessons: 10, videoUrl: '', description: 'Master retention funnels, SaaS pricing, and experiment-driven product roadmaps.' },
      { id: 5, title: 'PostgreSQL & Database Modeling', category: 'Development', instructor: 'Rohan Mehta', duration: '4h 55m', lessons: 15, videoUrl: '', description: 'Schema design, indexing strategies, transactions, and query optimization.' },
      { id: 6, title: 'Data Visualization & Storytelling', category: 'Data & AI', instructor: 'Dr. Kabir Nair', duration: '3h 30m', lessons: 9, videoUrl: '', description: 'Turn complex datasets into clear executive dashboards and visual narratives.' }
    ],
    liveSessions: [
      { id: 1, title: 'Live Q&A: Scaling Node.js & PostgreSQL', host: 'Rohan Mehta', date: 'Nov 28, 2026 • 7:00 PM IST', status: 'upcoming', duration: '60 mins', videoUrl: '', description: 'Interactive architecture review and live debugging session.' },
      { id: 2, title: 'Workshop Recording: Design Tokens in Action', host: 'Ananya Verma', date: 'Recorded Nov 18, 2026', status: 'recorded', duration: '52:10', videoUrl: '', description: 'Full replay of our hands-on design systems workshop with Q&A.' },
      { id: 3, title: 'Workshop Recording: Building AI Agents Safely', host: 'Dr. Kabir Nair', date: 'Recorded Nov 10, 2026', status: 'recorded', duration: '1:04:25', videoUrl: '', description: 'Recorded live session covering tool use, guardrails, and evaluation.' },
      { id: 4, title: 'Live Bootcamp: Launching Digital Products', host: 'Meera Kapoor', date: 'Dec 03, 2026 • 6:30 PM IST', status: 'upcoming', duration: '75 mins', videoUrl: '', description: 'Pricing, Razorpay checkout setup, and launch checklists.' }
    ],
    products: [
      { id: 1, title: 'Skill 365 Web Dev Starter Kit', type: 'Code Template', price: 499, filePath: '', description: 'Production-ready HTML/CSS/JS + Express boilerplate with auth & clean tokens.' },
      { id: 2, title: 'Modern UI/UX Playbook (PDF)', type: 'E-Book', price: 299, filePath: '', description: '120-page illustrated guide to spacing, typography, and design systems.' },
      { id: 3, title: '100+ AI Prompts for Developers', type: 'Toolkit', price: 399, filePath: '', description: 'Battle-tested prompt templates for code review, testing, and documentation.' }
    ],
    newsletters: [
      { id: 1, title: 'Issue #42: Designing High-Trust Learning Experiences', date: 'Nov 20, 2026', summary: 'How structured video chapters and milestone certificates boost course completion.', body: 'In this week’s issue, we break down the pillars of engaging online courses: focused 8-minute video chapters, hands-on projects, and verified milestone certificates.' },
      { id: 2, title: 'Issue #41: Razorpay & Digital Product Monetization', date: 'Nov 13, 2026', summary: 'A practical checklist for instructors launching e-books and code toolkits.', body: 'Digital products are the fastest way for instructors to complement video courses. Start with a focused template or checklist, price it accessibly, and bundle it with your flagship course.' },
      { id: 3, title: 'Issue #40: PostgreSQL Indexing Cheat Sheet', date: 'Nov 06, 2026', summary: 'When to use B-Tree, GIN, and partial indexes in growing web apps.', body: 'Database performance often comes down to choosing the right index for your read patterns. Here is our visual quick-reference guide used in Module 3.' }
    ],
    subscribers: [],
    orders: []
  };
}

let db;
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    db = createSeedData();
  }
} else {
  db = createSeedData();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Multer storage for videos, live recordings, and digital products
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'media/videos';
    if (req.path.includes('live')) folder = 'media/live';
    else if (req.path.includes('product')) folder = 'media/products';
    const dest = path.join(__dirname, folder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const upload = multer({ storage });

// Auth helpers
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

function sanitizeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    enrolledIds: u.enrolledIds || [],
    progress: u.progress || {},
    purchasedProductIds: u.purchasedProductIds || [],
    registeredLiveIds: u.registeredLiveIds || []
  };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u.id === payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Skill 365 LMS' }));

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'student' } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now(),
    name,
    email,
    password: hashed,
    role: ['student', 'instructor'].includes(role) ? role : 'student',
    status: 'Active',
    enrolledIds: [],
    progress: {},
    purchasedProductIds: [],
    registeredLiveIds: []
  };
  db.users.push(newUser);
  saveDB();
  res.json({ token: generateToken(newUser), user: sanitizeUser(newUser) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: generateToken(user), user: sanitizeUser(user) });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// Admin user management
app.get('/api/admin/users', authMiddleware, requireRole('admin'), (req, res) => {
  res.json(db.users.map(sanitizeUser));
});

// Courses
app.get('/api/courses', (req, res) => {
  res.json(db.courses);
});

app.post('/api/courses', authMiddleware, requireRole('instructor', 'admin'), upload.single('video'), (req, res) => {
  const { title, category = 'Development', duration = '1h 30m', lessons = 8, description = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Course title is required' });
  const videoUrl = req.file ? `/media/videos/${req.file.filename}` : '';
  const course = {
    id: Date.now(),
    title,
    category,
    instructor: req.user.name,
    duration,
    lessons: Number(lessons) || 8,
    videoUrl,
    description
  };
  db.courses.unshift(course);
  saveDB();
  res.status(201).json(course);
});

app.post('/api/courses/:id/enroll', authMiddleware, (req, res) => {
  const courseId = Number(req.params.id);
  const course = db.courses.find(c => c.id === courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (!req.user.enrolledIds.includes(courseId)) {
    req.user.enrolledIds.push(courseId);
    req.user.progress[courseId] = req.user.progress[courseId] || 15;
    saveDB();
  }
  res.json({ user: sanitizeUser(req.user), course });
});

app.post('/api/courses/:id/progress', authMiddleware, (req, res) => {
  const courseId = Number(req.params.id);
  const { percent = 100 } = req.body;
  if (!req.user.enrolledIds.includes(courseId)) req.user.enrolledIds.push(courseId);
  req.user.progress[courseId] = Math.min(100, Math.max(0, Number(percent)));
  saveDB();
  res.json({ user: sanitizeUser(req.user) });
});

// Live Sessions & Recordings
app.get('/api/live-sessions', (req, res) => {
  res.json(db.liveSessions);
});

app.post('/api/live-sessions', authMiddleware, requireRole('instructor', 'admin'), upload.single('video'), (req, res) => {
  const { title, date = 'Recorded Today', status = 'recorded', duration = '45:00', description = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Session title is required' });
  const videoUrl = req.file ? `/media/live/${req.file.filename}` : '';
  const session = {
    id: Date.now(),
    title,
    host: req.user.name,
    date,
    status,
    duration,
    videoUrl,
    description
  };
  db.liveSessions.unshift(session);
  saveDB();
  res.status(201).json(session);
});

app.post('/api/live-sessions/:id/register', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const idx = req.user.registeredLiveIds.indexOf(id);
  if (idx >= 0) req.user.registeredLiveIds.splice(idx, 1);
  else req.user.registeredLiveIds.push(id);
  saveDB();
  res.json({ user: sanitizeUser(req.user) });
});

// Digital Products & Mock Razorpay
app.get('/api/products', (req, res) => {
  res.json(db.products);
});

app.post('/api/products', authMiddleware, requireRole('instructor', 'admin'), upload.single('file'), (req, res) => {
  const { title, type = 'E-Book', price = 299, description = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Product title is required' });
  const filePath = req.file ? `/media/products/${req.file.filename}` : '';
  const product = { id: Date.now(), title, type, price: Number(price) || 299, filePath, description };
  db.products.unshift(product);
  saveDB();
  res.status(201).json(product);
});

app.post('/api/orders/create', authMiddleware, (req, res) => {
  const { productId } = req.body;
  const product = db.products.find(p => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const order = {
    id: 'order_rzp_' + Date.now(),
    productId: product.id,
    userId: req.user.id,
    amount: product.price * 100,
    currency: 'INR',
    status: 'created'
  };
  db.orders.push(order);
  saveDB();
  res.json(order);
});

app.post('/api/orders/verify', authMiddleware, (req, res) => {
  const { orderId, productId } = req.body;
  const order = db.orders.find(o => o.id === orderId);
  if (order) order.status = 'paid';
  const pid = Number(productId);
  if (!req.user.purchasedProductIds.includes(pid)) {
    req.user.purchasedProductIds.push(pid);
  }
  saveDB();
  res.json({ status: 'paid', user: sanitizeUser(req.user) });
});

app.get('/api/products/:id/download', authMiddleware, (req, res) => {
  const product = db.products.find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!req.user.purchasedProductIds.includes(product.id)) {
    return res.status(403).json({ error: 'Purchase required' });
  }
  if (product.filePath) {
    const abs = path.join(__dirname, product.filePath);
    if (fs.existsSync(abs)) return res.download(abs);
  }
  res.setHeader('Content-Disposition', `attachment; filename="${product.title.replace(/\s+/g, '_')}.txt"`);
  res.send(`Skill 365 Digital Product\nTitle: ${product.title}\nType: ${product.type}\nOwner: ${req.user.name} (${req.user.email})\nThank you for learning with Skill 365!`);
});

// Newsletters (Mock email logs to console)
app.get('/api/newsletters', (req, res) => {
  res.json(db.newsletters);
});

app.post('/api/newsletters/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!db.subscribers.includes(email)) {
    db.subscribers.push(email);
    saveDB();
  }
  console.log(`[Mock Email Service] Subscribed ${email} to Skill 365 Weekly Digest.`);
  res.json({ message: `Subscribed ${email} to Skill 365 Weekly Digest` });
});

app.post('/api/newsletters', authMiddleware, requireRole('admin'), (req, res) => {
  const { title, summary, body } = req.body;
  if (!title || !summary) return res.status(400).json({ error: 'Title and summary required' });
  const nl = {
    id: Date.now(),
    title,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    summary,
    body: body || summary
  };
  db.newsletters.unshift(nl);
  saveDB();
  console.log(`[Mock Email Service] Dispatched newsletter "${title}" to ${db.subscribers.length} subscribers.`);
  res.status(201).json(nl);
});

// Certificate PDF generation (PDFKit)
app.get('/api/certificate/:courseId', (req, res) => {
  const courseId = Number(req.params.courseId);
  const course = db.courses.find(c => c.id === courseId) || { title: 'Full-Stack Web Architecture' };
  const studentName = req.query.name || 'Aarav Sharma';
  const certId = `S365-2026-${courseId}${Math.floor(100 + Math.random() * 900)}`;

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Skill365_Certificate_${courseId}.pdf"`);
  doc.pipe(res);

  // Border
  doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).lineWidth(3).stroke('#1677F2');
  doc.rect(35, 35, doc.page.width - 70, doc.page.height - 70).lineWidth(1).stroke('#20C9A6');

  doc.moveDown(2);
  doc.fillColor('#20C9A6').fontSize(14).text('SKILL 365 LEARNING MANAGEMENT SYSTEM', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor('#0F172A').fontSize(32).text('Certificate of Completion', { align: 'center' });
  doc.moveDown(1.5);
  doc.fillColor('#475569').fontSize(15).text('This is to certify that', { align: 'center' });
  doc.moveDown(0.6);
  doc.fillColor('#1677F2').fontSize(28).text(studentName, { align: 'center' });
  doc.moveDown(0.6);
  doc.fillColor('#475569').fontSize(15).text('has successfully completed the program', { align: 'center' });
  doc.moveDown(0.6);
  doc.fillColor('#0F172A').fontSize(22).text(course.title, { align: 'center' });
  doc.moveDown(2.5);
  doc.fillColor('#475569').fontSize(12).text(`Issued: ${new Date().toDateString()}   |   Certificate ID: ${certId}`, { align: 'center' });
  doc.end();
});

app.listen(port, () => {
  console.log(`Skill 365 operational server listening on port ${port}`);
});
