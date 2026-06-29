## Task 1: Express Backend — Auth + In-Memory Store

**Files:**
- Create: `project/server/index.js`
- Create: `project/server/store.js`
- Create: `project/server/middleware/auth.js`
- Create: `project/server/routes/auth.js`
- Modify: `project/package.json` (add express, cors to dependencies; add `"server": "node server/index.js"` script)

**What this task builds:**
Express app on port 3001 with:
- `POST /api/auth/register` — creates user, returns JWT
- `POST /api/auth/login` — authenticates user, returns JWT
- `GET /api/auth/me` — returns current user from JWT (protected)
- In-memory store with `users` Map
- JWT middleware that reads `Authorization: Bearer <token>`

**Interfaces produced (used by Tasks 2, 3):**
- `store.users` — Map keyed by email: `{ id, email, passwordHash, fullName, phone, createdAt, subscription: null }`
- `store.getUser(email)`, `store.createUser(data)`, `store.updateUser(email, patch)`
- JWT payload shape: `{ userId, email, fullName }`
- Auth middleware: attaches `req.user = { userId, email, fullName }` or sends 401

**Steps:**

1. Run `cd /Users/piyush.m/Documents/ACS/Netflix-Clone/project && npm install express cors` to add deps

2. Create `project/server/store.js`:
```js
const { v4: uuidv4 } = require('uuid');

const users = new Map(); // email -> userRecord
const transactions = new Map(); // transactionId -> txnRecord
const otps = new Map(); // transactionId -> { otp, expiresAt, resendCount }

function createUser({ email, passwordHash, fullName, phone }) {
  const user = { id: uuidv4(), email, passwordHash, fullName, phone, createdAt: new Date().toISOString(), subscription: null };
  users.set(email, user);
  return user;
}

function getUser(email) { return users.get(email) || null; }

function updateUser(email, patch) {
  const user = users.get(email);
  if (!user) return null;
  Object.assign(user, patch);
  return user;
}

function createTransaction({ userId, email, planName, amountPaise }) {
  const { v4: uuidv4 } = require('uuid');
  const txn = {
    id: uuidv4(),
    userId, email, planName, amountPaise,
    phase: 'INITIATED',
    status: 'CREATED',
    otpResendCount: 0,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  transactions.set(txn.id, txn);
  return txn;
}

function getTransaction(id) { return transactions.get(id) || null; }

function updateTransaction(id, patch) {
  const txn = transactions.get(id);
  if (!txn) return null;
  Object.assign(txn, patch, { updatedAt: new Date().toISOString() });
  return txn;
}

function setOtp(transactionId, otp, resendCount) {
  otps.set(transactionId, { otp, expiresAt: Date.now() + 5 * 60 * 1000, resendCount });
}

function getOtp(transactionId) { return otps.get(transactionId) || null; }
function deleteOtp(transactionId) { otps.delete(transactionId); }

module.exports = { createUser, getUser, updateUser, createTransaction, getTransaction, updateTransaction, setOtp, getOtp, deleteOtp };
```

3. Create `project/server/middleware/auth.js`:
```js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'netflix-dev-secret-change-in-prod';

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
```

4. Create `project/server/routes/auth.js`:
```js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, getUser } = require('../store');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  const { email, password, fullName, phone } = req.body;
  if (!email || !password || !fullName) return res.status(400).json({ error: 'email, password and fullName required' });
  if (getUser(email)) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({ email, passwordHash, fullName, phone: phone || '' });
  const token = jwt.sign({ userId: user.id, email: user.email, fullName: user.fullName }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = getUser(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id, email: user.email, fullName: user.fullName }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, subscription: user.subscription } });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = getUser(req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, fullName: user.fullName, subscription: user.subscription, createdAt: user.createdAt });
});

module.exports = router;
```

5. Create `project/server/index.js`:
```js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Payment auth backend running on :${PORT}`));
```

6. Add to `project/package.json`:
   - Add `"express": "^4.18.2"` and `"cors": "^2.8.5"` to `dependencies`
   - Add `"server": "node server/index.js"` to `scripts`

7. Test: `cd project && node server/index.js &` then `curl -s http://localhost:3001/api/health` → `{"status":"ok"}`; kill background node process

8. Commit: `git add project/server/ project/package.json project/package-lock.json && git commit -m "feat: Express backend — auth routes, JWT middleware, in-memory store"`

---

