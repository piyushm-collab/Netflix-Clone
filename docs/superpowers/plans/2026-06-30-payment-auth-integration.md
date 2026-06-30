# Payment Auth Integration — Netflix Clone

**Goal:** Replace Supabase auth with a custom JWT backend and add an OTP-based subscription payment flow to the Netflix Clone.

**Architecture:** New Express.js backend in `project/server/` uses in-memory store (no DB/Redis needed). Frontend replaces all Supabase calls with axios calls to `localhost:3001`. New "Plans" and "Payment/OTP" pages wire into existing React Router setup.

**Tech Stack:** React 18 + TypeScript + Vite (existing), Express.js + jsonwebtoken + bcryptjs + uuid (new backend, deps already in package.json), axios (already present)

## Global Constraints

- Working directory for ALL changes: `project/` inside `/Users/piyush.m/Documents/ACS/Netflix-Clone/`
- Backend lives at `project/server/` — plain JavaScript (no TypeScript for backend)
- Backend runs on port 3001; frontend Vite dev server proxies `/api` to `http://localhost:3001`
- All Supabase imports (`@supabase/supabase-js`, `@supabase/auth-helpers-react`, `@supabase/ssr`) must be removed from the frontend — zero remaining references
- AuthContext interface stays compatible: `{ user, loading, signOut }` — ProtectedRoute.tsx must not change
- JWT stored in `localStorage` key `netflix_token`; user object stored in `localStorage` key `netflix_user`
- OTP is 6 digits, logged to server console (no SMS service needed)
- OTP TTL: 5 minutes (in-memory expiry check)
- Max OTP resend: 3 attempts per transaction
- Transaction states: `CREATED → OTP_SENT → OTP_VERIFIED → PAYMENT_COMPLETE`
- Transaction phase: `INITIATED` when status=CREATED, `CHALLENGE` when status=OTP_SENT/OTP_VERIFIED, `COMPLETED` when status=PAYMENT_COMPLETE/FAILED/TIMED_OUT
- Netflix subscription plans: Basic (₹199/mo), Standard (₹499/mo), Premium (₹799/mo)
- New routes added to App.tsx: `/plans` (protected), `/payment/:transactionId` (protected)
- ProfilePage shows subscription plan name + status (fetched from backend GET /api/subscriptions/active)
- `project/server/index.js` is the backend entry point; start command `node server/index.js`
- Do NOT modify `ProtectedRoute.tsx` — it uses `useAuth()` which we rewrite in AuthContext
- Tailwind CSS for all new UI components — match existing Netflix dark theme (bg-black, text-white, red-600 for CTAs)
- No TypeScript in backend files (`.js` only)
- Add `express` and `cors` to `project/package.json` dependencies

---

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

## Task 2: Express Backend — Subscription/Payment Routes

**Files:**
- Create: `project/server/routes/subscriptions.js`

**Interfaces produced (used by Task 4):**
- `POST /api/subscriptions` body: `{ planName, amountPaise }` → returns `{ id, planName, amountPaise, status, phase }`
- `POST /api/subscriptions/:id/otp/send` → returns `{ transactionId, message, resendCount }`
- `POST /api/subscriptions/:id/otp/verify` body: `{ otp }` → returns full transaction with `status: PAYMENT_COMPLETE`
- `GET /api/subscriptions/:id` → returns transaction
- `GET /api/subscriptions/active` → returns user's active subscription or `null`

**State machine transitions:**
- `CREATED` → `OTP_SENT` (on send-otp); phase becomes `CHALLENGE`
- `OTP_SENT` → `OTP_VERIFIED` (on correct verify); then immediately → `PAYMENT_COMPLETE`; phase becomes `COMPLETED`
- Any terminal status (`PAYMENT_COMPLETE`, `FAILED`) → no further transitions

**Steps:**

1. Create `project/server/routes/subscriptions.js`:
```js
const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const store = require('../store');

const PLANS = {
  Basic:    { name: 'Basic',    amountPaise: 19900 },
  Standard: { name: 'Standard', amountPaise: 49900 },
  Premium:  { name: 'Premium',  amountPaise: 79900 },
};

const TRANSITIONS = {
  CREATED:          ['OTP_SENT'],
  OTP_SENT:         ['OTP_VERIFIED', 'OTP_SENT'],
  OTP_VERIFIED:     ['PAYMENT_COMPLETE'],
  PAYMENT_COMPLETE: [],
  FAILED:           [],
};

function phaseFor(status) {
  if (['CREATED'].includes(status)) return 'INITIATED';
  if (['OTP_SENT', 'OTP_VERIFIED'].includes(status)) return 'CHALLENGE';
  return 'COMPLETED';
}

router.get('/active', authMiddleware, (req, res) => {
  const user = store.getUser(req.user.email);
  res.json({ subscription: user?.subscription || null });
});

router.post('/', authMiddleware, (req, res) => {
  const { planName } = req.body;
  if (!PLANS[planName]) return res.status(400).json({ error: 'Invalid plan. Choose Basic, Standard, or Premium.' });
  const plan = PLANS[planName];
  const txn = store.createTransaction({ userId: req.user.userId, email: req.user.email, planName: plan.name, amountPaise: plan.amountPaise });
  res.json(txn);
});

router.post('/:id/otp/send', authMiddleware, (req, res) => {
  const txn = store.getTransaction(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txn.email !== req.user.email) return res.status(403).json({ error: 'Access denied' });
  if (!TRANSITIONS[txn.status]?.includes('OTP_SENT')) return res.status(409).json({ error: `Cannot send OTP in status ${txn.status}` });

  const existing = store.getOtp(req.params.id);
  const resendCount = (existing?.resendCount || 0) + 1;
  if (resendCount > 3) return res.status(429).json({ error: 'Maximum OTP resend attempts reached' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  store.setOtp(req.params.id, otp, resendCount);
  store.updateTransaction(req.params.id, { status: 'OTP_SENT', phase: 'CHALLENGE', otpResendCount: resendCount });

  console.log(`[OTP] transactionId=${req.params.id} otp=${otp} (demo only — never log in prod)`);

  res.json({ transactionId: req.params.id, message: 'OTP sent. Check server console for demo OTP.', resendCount });
});

router.post('/:id/otp/verify', authMiddleware, (req, res) => {
  const { otp } = req.body;
  const txn = store.getTransaction(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txn.email !== req.user.email) return res.status(403).json({ error: 'Access denied' });
  if (txn.status !== 'OTP_SENT') return res.status(409).json({ error: `Cannot verify OTP in status ${txn.status}` });

  const otpRecord = store.getOtp(req.params.id);
  if (!otpRecord) return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  if (Date.now() > otpRecord.expiresAt) { store.deleteOtp(req.params.id); return res.status(400).json({ error: 'OTP expired. Please request a new one.' }); }
  if (otpRecord.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

  store.deleteOtp(req.params.id);
  const updated = store.updateTransaction(req.params.id, { status: 'PAYMENT_COMPLETE', phase: 'COMPLETED' });

  // Activate subscription on user
  store.updateUser(req.user.email, {
    subscription: { planName: txn.planName, amountPaise: txn.amountPaise, activatedAt: new Date().toISOString(), transactionId: txn.id }
  });

  res.json(updated);
});

router.get('/:id', authMiddleware, (req, res) => {
  const txn = store.getTransaction(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txn.email !== req.user.email) return res.status(403).json({ error: 'Access denied' });
  res.json(txn);
});

module.exports = router;
```

2. Test the full flow manually:
```bash
cd /Users/piyush.m/Documents/ACS/Netflix-Clone/project
node server/index.js &
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234","fullName":"Test User"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
TXN=$(curl -s -X POST http://localhost:3001/api/subscriptions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"planName":"Premium"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X POST http://localhost:3001/api/subscriptions/$TXN/otp/send \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Note OTP from server console, then:
# curl -s -X POST http://localhost:3001/api/subscriptions/$TXN/otp/verify \
#   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
#   -d '{"otp":"<OTP_FROM_CONSOLE>"}' | python3 -m json.tool
kill %1
```
Expected: subscription routes work; OTP appears in console.

3. Commit: `git add project/server/routes/subscriptions.js && git commit -m "feat: subscription payment routes — OTP state machine, plan management"`

---

## Task 3: Remove Supabase — Rewrite AuthContext + Auth Forms

**Files:**
- Modify: `project/src/context/AuthContext.tsx` (complete rewrite — no Supabase)
- Modify: `project/src/components/auth/SignInForm.tsx` (call our backend)
- Modify: `project/src/components/auth/SignUpForm.tsx` (call our backend, add fullName + phone fields)
- Create: `project/src/lib/apiClient.ts` (axios instance with JWT header injection)
- Modify: `project/src/App.tsx` (remove SupabaseProvider wrapper)
- Delete references to Supabase in: `project/src/context/SupabaseProvider.tsx` (keep file but make it a passthrough)
- Modify: `project/vite.config.js` (add proxy: `/api` → `http://localhost:3001`)

**DO NOT modify:** `project/src/components/ProtectedRoute.tsx` — it reads `useAuth()` which this task rewrites

**AuthContext interface (must be exactly this — ProtectedRoute depends on `user` being truthy when logged in):**
```ts
interface AuthContextType {
  user: { id: string; email: string; fullName: string; subscription: any } | null;
  loading: boolean;
  signOut: () => void;
}
```

**Steps:**

1. Create `project/src/lib/apiClient.ts`:
```ts
import axios from 'axios';

const apiClient = axios.create({ baseURL: '/api' });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('netflix_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default apiClient;
```

2. Rewrite `project/src/context/AuthContext.tsx`:
```tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import apiClient from '../lib/apiClient';

interface NetflixUser {
  id: string;
  email: string;
  fullName: string;
  subscription: { planName: string; activatedAt: string } | null;
}

interface AuthContextType {
  user: NetflixUser | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: () => {} });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<NetflixUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('netflix_token');
    if (!token) { setLoading(false); return; }
    apiClient.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => { localStorage.removeItem('netflix_token'); localStorage.removeItem('netflix_user'); })
      .finally(() => setLoading(false));
  }, []);

  const signOut = () => {
    localStorage.removeItem('netflix_token');
    localStorage.removeItem('netflix_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
};
```

3. Make `project/src/context/SupabaseProvider.tsx` a no-op passthrough (do NOT delete file — App.tsx imports it; just gut the Supabase logic):
```tsx
import React from 'react';
export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const useSupabase = () => ({});
```

4. Rewrite `project/src/components/auth/SignInForm.tsx` — replace `signIn` from supabase with apiClient call:
   - Keep Formik, Yup, framer-motion, same layout
   - On submit: `POST /api/auth/login` via apiClient
   - On success: store token in localStorage, store user in localStorage, update AuthContext user via navigate to /browse
   - The component cannot call setUser directly (no setter exposed) — instead do `window.location.href = '/browse'` after storing token (triggers AuthContext re-init)

```tsx
// SignInForm.tsx — key change in handleSubmit:
const handleSubmit = async (values: { email: string; password: string }, { setSubmitting }: any) => {
  try {
    const { data } = await apiClient.post('/auth/login', values);
    localStorage.setItem('netflix_token', data.token);
    localStorage.setItem('netflix_user', JSON.stringify(data.user));
    toast.success('Sign in successful!');
    window.location.href = '/browse';
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Invalid email or password');
  } finally {
    setSubmitting(false);
  }
};
```

5. Rewrite `project/src/components/auth/SignUpForm.tsx` — add fullName field, call `POST /api/auth/register`:
```tsx
// SignUpForm.tsx — schema adds fullName:
const SignUpSchema = Yup.object().shape({
  fullName: Yup.string().required('Full name is required'),
  email: Yup.string().email('Please enter a valid email').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Passwords must match').required('Please confirm your password'),
});
// handleSubmit:
const handleSubmit = async (values: any, { setSubmitting }: any) => {
  try {
    const { data } = await apiClient.post('/auth/register', { email: values.email, password: values.password, fullName: values.fullName });
    localStorage.setItem('netflix_token', data.token);
    localStorage.setItem('netflix_user', JSON.stringify(data.user));
    toast.success('Account created! Welcome to Netflix.');
    window.location.href = '/browse';
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to sign up');
  } finally {
    setSubmitting(false);
  }
};
```

6. Add Vite proxy — in `project/vite.config.js`, add inside `defineConfig`:
```js
server: {
  proxy: {
    '/api': { target: 'http://localhost:3001', changeOrigin: true }
  }
}
```

7. Verify the app starts: `cd project && npm run dev` — check for TypeScript errors. Fix any import errors from removed Supabase types.

8. Commit: `git add project/src/ project/vite.config.js && git commit -m "feat: replace Supabase auth with custom JWT backend — AuthContext, SignIn/SignUp forms, apiClient"`

---

## Task 4: Plans Page + Payment OTP Page (New UI)

**Files:**
- Create: `project/src/pages/Plans/PlansPage.tsx`
- Create: `project/src/pages/Plans/PlansPage.css`
- Create: `project/src/pages/Payment/PaymentPage.tsx`
- Create: `project/src/pages/Payment/PaymentPage.css`
- Modify: `project/src/App.tsx` (add `/plans` and `/payment/:transactionId` routes)
- Modify: `project/src/components/Navbar/BrowseNavbar.tsx` (add "Plans" link)

**PlansPage UI:**
- Netflix dark theme (bg-black)
- Three plan cards: Basic (₹199/mo), Standard (₹499/mo), Premium (₹799/mo)
- Each card: plan name, price, features list (quality, screens, downloads)
- "Subscribe" button on each card → `POST /api/subscriptions` → navigate to `/payment/:transactionId`
- If user already has a subscription, show "Current Plan" badge on their plan

**PaymentPage UI:**
- Shows transaction details (plan name, amount)
- "Send OTP" button → `POST /api/subscriptions/:id/otp/send` → shows "OTP sent to console. Enter it below."
- 6-digit OTP input field
- "Verify & Activate" button → `POST /api/subscriptions/:id/otp/verify` → on success navigate to `/profile` with success toast
- Shows transaction status (CREATED → OTP_SENT → PAYMENT_COMPLETE)
- Loading states, error messages

**Steps:**

1. Create `project/src/pages/Plans/PlansPage.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import BrowseNavbar from '../../components/Navbar/BrowseNavbar';
import './PlansPage.css';

const PLANS = [
  { name: 'Basic', amountPaise: 19900, display: '₹199/mo', quality: 'Good', screens: 1, downloads: 0, color: 'border-zinc-600' },
  { name: 'Standard', amountPaise: 49900, display: '₹499/mo', quality: 'Better', screens: 2, downloads: 2, color: 'border-blue-500', popular: true },
  { name: 'Premium', amountPaise: 79900, display: '₹799/mo', quality: 'Best', screens: 4, downloads: 6, color: 'border-red-600' },
];

const PlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: typeof PLANS[0]) => {
    setLoading(plan.name);
    try {
      const { data } = await apiClient.post('/subscriptions', { planName: plan.name, amountPaise: plan.amountPaise });
      navigate(`/payment/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate subscription');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <BrowseNavbar />
      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose your plan</h1>
          <p className="text-zinc-400 text-lg">Watch on any device. Cancel anytime.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => {
            const isCurrent = user?.subscription?.planName === plan.name;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-zinc-900 rounded-xl border-2 ${plan.color} p-8 flex flex-col`}
              >
                {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-4 py-1 rounded-full">MOST POPULAR</div>}
                {isCurrent && <div className="absolute -top-3 right-4 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">CURRENT PLAN</div>}
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <p className="text-3xl font-bold text-red-500 mb-6">{plan.display}</p>
                <ul className="space-y-3 mb-8 flex-1 text-zinc-300">
                  <li>✓ Video quality: {plan.quality}</li>
                  <li>✓ Watch on {plan.screens} screen{plan.screens > 1 ? 's' : ''} at once</li>
                  <li>{plan.downloads > 0 ? `✓ ${plan.downloads} downloads/month` : '✗ No downloads'}</li>
                  <li>✓ Cancel anytime</li>
                </ul>
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading === plan.name || isCurrent}
                  className={`w-full py-3 rounded-lg font-bold transition-colors ${isCurrent ? 'bg-green-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {loading === plan.name ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : isCurrent ? 'Active Plan' : 'Subscribe'}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlansPage;
```

2. Create `project/src/pages/Plans/PlansPage.css` — empty (all Tailwind).

3. Create `project/src/pages/Payment/PaymentPage.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import apiClient from '../../lib/apiClient';
import BrowseNavbar from '../../components/Navbar/BrowseNavbar';
import './PaymentPage.css';

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Payment initiated',
  OTP_SENT: 'OTP sent — verify below',
  PAYMENT_COMPLETE: 'Payment complete!',
};

const PaymentPage: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const [txn, setTxn] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!transactionId) return;
    apiClient.get(`/subscriptions/${transactionId}`).then(r => setTxn(r.data)).catch(() => toast.error('Transaction not found'));
  }, [transactionId]);

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const { data } = await apiClient.post(`/subscriptions/${transactionId}/otp/send`);
      toast.success(data.message);
      setTxn((t: any) => ({ ...t, status: 'OTP_SENT' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setVerifying(true);
    try {
      const { data } = await apiClient.post(`/subscriptions/${transactionId}/otp/verify`, { otp });
      setTxn(data);
      toast.success(`🎉 ${data.planName} plan activated!`);
      setTimeout(() => navigate('/profile'), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (!txn) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>;

  const isComplete = txn.status === 'PAYMENT_COMPLETE';

  return (
    <div className="min-h-screen bg-black text-white">
      <BrowseNavbar />
      <div className="flex items-center justify-center min-h-screen px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 rounded-2xl p-10 w-full max-w-md border border-zinc-700">
          <h1 className="text-2xl font-bold mb-2 text-center">{isComplete ? '🎉 Subscription Activated' : 'Complete Your Subscription'}</h1>
          <p className="text-zinc-400 text-center mb-8">{isComplete ? `You are now on the ${txn.planName} plan!` : 'Verify your identity with a one-time password'}</p>

          <div className="bg-zinc-800 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between"><span className="text-zinc-400">Plan</span><span className="font-semibold">{txn.planName}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Amount</span><span className="font-semibold text-red-400">₹{(txn.amountPaise / 100).toFixed(0)}/mo</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Status</span>
              <span className={`font-semibold ${isComplete ? 'text-green-400' : 'text-yellow-400'}`}>{STATUS_LABELS[txn.status] || txn.status}</span>
            </div>
            <div className="flex justify-between"><span className="text-zinc-400">Phase</span><span className="text-zinc-300">{txn.phase}</span></div>
          </div>

          {!isComplete && (
            <>
              <button onClick={handleSendOtp} disabled={sendingOtp || txn.status === 'OTP_SENT'} className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold mb-4 transition-colors disabled:opacity-50">
                {sendingOtp ? 'Sending...' : txn.status === 'OTP_SENT' ? 'OTP Sent (check server console)' : 'Send OTP'}
              </button>
              {txn.status === 'OTP_SENT' && (
                <div className="space-y-4">
                  <input
                    type="text" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-center text-2xl tracking-[1rem] font-mono focus:border-red-500 focus:outline-none"
                  />
                  <button onClick={handleVerify} disabled={verifying || otp.length !== 6} className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors disabled:opacity-50">
                    {verifying ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'Verify & Activate →'}
                  </button>
                </div>
              )}
              <p className="text-zinc-500 text-xs text-center mt-4">OTP is printed in the server console (demo mode)</p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentPage;
```

4. Create `project/src/pages/Payment/PaymentPage.css` — empty (all Tailwind).

5. Add routes in `project/src/App.tsx` — add after existing browse routes:
```tsx
import PlansPage from './pages/Plans/PlansPage';
import PaymentPage from './pages/Payment/PaymentPage';

// Inside router, add:
<Route path="/plans" element={<Suspense fallback={<Loading />}><ProtectedRoute><PlansPage /></ProtectedRoute></Suspense>} />
<Route path="/payment/:transactionId" element={<Suspense fallback={<Loading />}><ProtectedRoute><PaymentPage /></ProtectedRoute></Suspense>} />
```

6. Add "Plans" link to BrowseNavbar — find where nav links are rendered and add:
```tsx
<Link to="/plans" className="text-white hover:text-zinc-300 transition-colors">Plans</Link>
```

7. Commit: `git add project/src/pages/Plans/ project/src/pages/Payment/ project/src/App.tsx project/src/components/Navbar/BrowseNavbar.tsx && git commit -m "feat: Plans page (plan picker) and Payment page (OTP verification flow)"`

---

## Task 5: Update ProfilePage + Cleanup + Environment

**Files:**
- Modify: `project/src/pages/Profile/ProfilePage.tsx` (remove Supabase, show subscription from AuthContext)
- Modify: `project/.env.example` (remove Supabase vars, add VITE_API_URL)
- Create: `project/.env` (local dev env file, gitignored)
- Modify: `project/package.json` (add `"dev:full"` script to start both backend and frontend)
- Modify: `README.md` (update to describe custom auth + payment flow)

**ProfilePage changes:**
- Remove `import { supabase }` and the Supabase `from('profiles').select` call
- Read user from `useAuth()` hook — subscription data is already on the user object
- Show: name, email, subscription plan (or "No active subscription" + link to /plans)
- Keep existing sign-out button

**Steps:**

1. Rewrite `project/src/pages/Profile/ProfilePage.tsx`:
   - Remove `import { supabase }` line
   - Remove `fetchProfile` useEffect
   - Use `user` from `useAuth()` directly
   - Show subscription details from `user.subscription`
   - If no subscription: show "No active plan" + button to navigate('/plans')
   - Keep sign-out logic: call `signOut()` from useAuth, then `navigate('/')`

2. Update `project/.env.example`:
```env
# Custom Backend
VITE_API_URL=http://localhost:3001

# TMDb API Configuration
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_TMDB_USERNAME=your_tmdb_username
VITE_TMDB_PASSWORD=your_tmdb_password
```

3. Add `"dev:full"` to `project/package.json` scripts:
```json
"dev:full": "node server/index.js & npm run dev"
```

4. Update root `README.md` to describe:
   - Custom auth (no Supabase)
   - How to run: `cd project && npm install && node server/index.js` in one terminal, `npm run dev` in another
   - Payment flow walkthrough
   - OTP demo instructions (check server console)

5. Remove any remaining Supabase type imports. Check `project/src/types/supabase.ts` exists but is not imported anywhere — if it is imported, remove those imports.

6. Verify zero Supabase references remain:
   - Run: `grep -r "supabase" project/src/ --include="*.ts" --include="*.tsx" -l`
   - Expected output: only `supabase.ts` and `SupabaseProvider.tsx` (which are now gutted) — no active imports anywhere else

7. Commit: `git add project/src/pages/Profile/ project/.env.example project/package.json README.md && git commit -m "feat: remove Supabase from ProfilePage, update env config, add dev:full script"`

---

## Task 6: Final Integration Verification + Push

**Goal:** Ensure the full app works end-to-end before pushing.

**Steps:**

1. Start the backend: `cd /Users/piyush.m/Documents/ACS/Netflix-Clone/project && node server/index.js &`

2. Start the frontend: `npm run dev &`

3. Verify backend health: `curl -s http://localhost:3001/api/health` → `{"status":"ok"}`

4. Verify no TypeScript compile errors: `npx tsc --noEmit` from `project/`

5. Verify no remaining Supabase imports in active files:
   ```bash
   grep -r "from '.*supabase'" project/src/ --include="*.ts" --include="*.tsx" | grep -v "SupabaseProvider\|supabase.ts\|supabase.js"
   ```
   Expected: empty output.

6. Kill dev processes

7. Push the feature branch to GitHub:
   ```bash
   cd /Users/piyush.m/Documents/ACS/Netflix-Clone
   git push origin payment-auth-integration
   ```

8. Merge into main:
   ```bash
   git checkout main
   git merge payment-auth-integration
   git push origin main
   ```

9. Final commit if anything was missed: `git add -A && git commit -m "chore: final cleanup before push"`
