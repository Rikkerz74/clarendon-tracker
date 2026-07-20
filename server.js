const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'clarendon-dev-secret';
const DEMO_EMAIL = process.env.DEFAULT_OWNER_EMAIL || 'owner@clarendon.local';
const DEMO_PASSWORD = process.env.DEFAULT_OWNER_PASSWORD || 'ChangeMe123!';
const DEMO_NAME = process.env.DEFAULT_OWNER_NAME || 'Practice Owner';
const STATE_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.xls',
  '.xlsx',
  '.doc',
  '.docx',
  '.pdf'
]);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const clients = new Set();

function defaultSectionState() {
  return {
    status: 'Not started',
    priority: 'Medium',
    score: '3',
    owner: '',
    notes: '',
    evidence: '',
    actions: '',
    questions: ''
  };
}

function defaultRegistry() {
  const sectionIds = ['financial', 'patients', 'marketing', 'team', 'operations', 'capacity', 'commercial'];
  return {
    version: 2,
    activePracticeId: 'clarendon-main',
    updatedAt: null,
    practices: {
      'clarendon-main': {
        practiceId: 'clarendon-main',
        practiceName: 'Clarendon Dental, Southsea',
        diagnosticWindow: 'Phase 1 - 30 Day Business Diagnostic',
        createdAt: new Date().toISOString(),
        updatedAt: null,
        sections: Object.fromEntries(sectionIds.map((sectionId) => [sectionId, defaultSectionState()]))
      }
    }
  };
}

function defaultState() {
  return {
    users: [],
    registry: defaultRegistry()
  };
}

async function ensureStateFile() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(STATE_FILE);
  } catch {
    const initialState = defaultState();
    initialState.users = [];
    await fs.writeFile(STATE_FILE, JSON.stringify(initialState, null, 2), 'utf8');
  }
}

function documentFileName(originalName) {
  const safeExt = path.extname(String(originalName || '')).toLowerCase();
  const ext = ALLOWED_DOCUMENT_EXTENSIONS.has(safeExt) ? safeExt : '.bin';
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}${ext}`;
}

const uploadDocument = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, documentFileName(file.originalname))
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
      cb(new Error('Unsupported document format.'));
      return;
    }
    cb(null, true);
  }
});

function normalizeDocuments(rawDocuments) {
  if (!Array.isArray(rawDocuments)) {
    return [];
  }

  return rawDocuments
    .filter((entry) => entry && typeof entry === 'object' && entry.id && entry.storedName)
    .map((entry) => ({
      id: String(entry.id),
      title: String(entry.title || entry.originalName || 'Uploaded document'),
      originalName: String(entry.originalName || 'document'),
      storedName: String(entry.storedName),
      mimeType: String(entry.mimeType || 'application/octet-stream'),
      size: Number(entry.size || 0),
      uploadedAt: entry.uploadedAt || new Date().toISOString(),
      uploadedBy: String(entry.uploadedBy || ''),
      description: String(entry.description || ''),
      audience: String(entry.audience || '')
    }));
}

async function ensureDemoUser(state) {
  if (!Array.isArray(state.users)) {
    state.users = [];
  }

  const hasDemoUser = state.users.some((user) => String(user.email).toLowerCase() === DEMO_EMAIL.toLowerCase());
  if (!hasDemoUser) {
    state.users.push({
      id: 'owner-1',
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      role: 'owner',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10)
    });
  }

  return state;
}

async function loadState() {
  await ensureStateFile();
  const raw = await fs.readFile(STATE_FILE, 'utf8');
  const state = JSON.parse(raw);
  const normalized = await ensureDemoUser(state);
  if (normalized !== state) {
    await saveState(normalized);
  } else if (!state.users || state.users.length === 0) {
    await saveState(normalized);
  }
  return normalized;
}

async function saveState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

function signToken(user) {
  return jwt.sign(publicUser(user), JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getUserFromRequest(req) {
  if (!req.cookies.auth) {
    return null;
  }

  try {
    return verifyToken(req.cookies.auth);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.redirect('/login.html');
  }

  req.user = user;
  next();
}

function broadcastRegistry(registry) {
  const payload = `data: ${JSON.stringify(registry)}\n\n`;
  for (const client of clients) {
    client.res.write(payload);
  }
}

function withState(handler) {
  return async (req, res, next) => {
    try {
      const state = await loadState();
      req.storeState = state;
      req.registry = state.registry;
      req.users = state.users;
      return handler(req, res, next, state);
    } catch (error) {
      return next(error);
    }
  };
}

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/assets/tdbmlogo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'tdbmlogo.png'));
});

app.post('/api/login', withState(async (req, res, _next, state) => {
  const { email, password } = req.body || {};
  const user = state.users.find((entry) => entry.email.toLowerCase() === String(email || '').toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  res.cookie('auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ user: publicUser(user) });
}));

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/state', requireAuth, withState(async (req, res) => {
  res.json(req.registry);
}));

app.post('/api/state', requireAuth, withState(async (req, res, _next, state) => {
  const incoming = req.body && (req.body.registry || req.body.state || req.body);
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Missing registry payload' });
  }

  state.registry = incoming;
  if (!state.registry.updatedAt) {
    state.registry.updatedAt = new Date().toISOString();
  }
  const activePractice = state.registry.practices && state.registry.practices[state.registry.activePracticeId];
  if (activePractice) {
    activePractice.updatedAt = state.registry.updatedAt;
  }

  await saveState(state);
  broadcastRegistry(state.registry);
  res.json({ ok: true, registry: state.registry });
}));

app.get('/api/documents', requireAuth, withState(async (req, res) => {
  const documents = normalizeDocuments(req.registry.documents);
  res.json({ documents });
}));

app.post('/api/documents', requireAuth, uploadDocument.single('document'), withState(async (req, res, _next, state) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No document uploaded.' });
  }

  const documents = normalizeDocuments(state.registry.documents);
  const now = new Date().toISOString();
  const title = String((req.body && req.body.title) || req.file.originalname || 'Uploaded document').trim();
  const description = String((req.body && req.body.description) || '').trim();
  const audience = String((req.body && req.body.audience) || '').trim();

  documents.unshift({
    id: `doc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: title || 'Uploaded document',
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: now,
    uploadedBy: req.user.id,
    description,
    audience
  });

  state.registry.documents = documents;
  state.registry.updatedAt = now;
  await saveState(state);
  broadcastRegistry(state.registry);

  return res.status(201).json({ documents });
}));

app.get('/api/documents/:documentId', requireAuth, withState(async (req, res) => {
  const documents = normalizeDocuments(req.registry.documents);
  const document = documents.find((entry) => entry.id === req.params.documentId);

  if (!document) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const filePath = path.join(UPLOAD_DIR, document.storedName);
  res.type(document.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
  return res.sendFile(filePath);
}));

app.delete('/api/documents/:documentId', requireAuth, withState(async (req, res, _next, state) => {
  const documents = normalizeDocuments(state.registry.documents);
  const index = documents.findIndex((entry) => entry.id === req.params.documentId);

  if (index === -1) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const [removed] = documents.splice(index, 1);
  state.registry.documents = documents;
  state.registry.updatedAt = new Date().toISOString();

  try {
    await fs.unlink(path.join(UPLOAD_DIR, removed.storedName));
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }

  await saveState(state);
  broadcastRegistry(state.registry);
  return res.json({ documents });
}));

app.get('/api/events', requireAuth, withState(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(req.registry)}\n\n`);

  const client = { res };
  clients.add(client);

  req.on('close', () => {
    clients.delete(client);
  });
}));

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/roadmap.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'roadmap.html'));
});

app.get('/phase2.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'phase2.html'));
});

app.get('/phase3.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'phase3.html'));
});

app.get('/phase1-details.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'phase1-details.html'));
});

app.get('/phase2-details.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'phase2-details.html'));
});

app.get('/phase3-details.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'phase3-details.html'));
});

app.get('/reports.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'reports.html'));
});

app.get('/styles.css', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.get('/app.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/roadmap.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'roadmap.js')));
app.get('/phase-scoring.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'phase-scoring.js')));
app.get('/phase1-details.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'phase1-details.js')));
app.get('/phase2-details.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'phase2-details.js')));
app.get('/phase3-details.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'phase3-details.js')));
app.get('/reports.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'reports.js')));
app.get('/manifest.json', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/icon.svg', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'icon.svg')));

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 25MB.' });
    }
    return res.status(400).json({ error: 'Upload failed. Please try another file.' });
  }

  if (error && error.message === 'Unsupported document format.') {
    return res.status(400).json({ error: 'Unsupported format. Use txt, md, csv, xls, xlsx, doc, docx, or pdf.' });
  }

  return next(error);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.redirect('/login.html');
});

app.listen(PORT, async () => {
  await ensureStateFile();
  console.log(`Clarendon hosted app running on http://localhost:${PORT}`);
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
});
