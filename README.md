# Netflix Clone — Payment Authentication Feature

A full-stack Netflix-style app with a custom **OTP-based payment authentication** system. No Supabase, no paid services — runs entirely on your machine.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Animations | Framer Motion + GSAP |
| Backend | Node.js + Express (custom, no framework lock-in) |
| Auth | JWT (jsonwebtoken) + bcryptjs — stateless, stored in localStorage |
| OTP Store | In-memory with TTL (no Redis needed for demo) |
| Movie Data | TMDb API v3 |

## Payment Auth Feature (Resume Highlight)

```
User Flow:
1. Sign up / Sign in → JWT issued by custom Express backend
2. Browse → click "Plans" in navbar
3. Choose a plan (Basic ₹199 / Standard ₹499 / Premium ₹799)
4. "Subscribe" → transaction created (status: CREATED, phase: INITIATED)
5. "Send OTP" → 6-digit OTP printed to server console (status: OTP_SENT, phase: CHALLENGE)
6. Enter OTP → verify → subscription activated (status: PAYMENT_COMPLETE, phase: COMPLETED)
7. Profile page shows active plan + activation date
```

### Key Engineering Concepts Demonstrated

- **Dual-state transaction model** — `TransactionPhase` (INITIATED/CHALLENGE/COMPLETED) and `TransactionStatus` (CREATED/OTP_SENT/OTP_VERIFIED/PAYMENT_COMPLETE) always transition together
- **State machine** — explicit allowed-transitions table in `server/routes/subscriptions.js`; illegal moves return 409
- **OTP TTL** — 5-minute expiry checked server-side; deleted from store on successful verify
- **Rate limiting** — max 3 OTP resends per transaction, tracked server-side
- **JWT auth** — stateless, 24-hour expiry, Bearer token in Authorization header
- **Masked logging** — OTP only printed to console (demo), never to client response body

## Quick Start

### 1. Prerequisites
- Node.js 18+
- TMDb API key (free at [themoviedb.org](https://www.themoviedb.org))

### 2. Install & Run

**Terminal 1 — Backend (port 3001):**
```bash
cd project
npm install
node server/index.js
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd project
npm run dev
```

Open http://localhost:5173

### 3. Environment
Copy `.env.example` to `.env` and fill in your TMDb API key:
```bash
cd project
cp .env.example .env
# Edit .env and set VITE_TMDB_API_KEY=your_key
```

### 4. Demo the Payment Flow
1. Register a new account at `/signup`
2. Click **Plans** in the navbar
3. Click **Get Premium** (or any plan)
4. Click **Send OTP** — watch **Terminal 1** for the OTP
5. Type the OTP in the UI → click **Verify & Activate**
6. Check `/profile` — your plan is now active

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register + get JWT |
| POST | `/api/auth/login` | No | Login + get JWT |
| GET | `/api/auth/me` | JWT | Get current user |
| POST | `/api/subscriptions` | JWT | Initiate payment (creates transaction) |
| POST | `/api/subscriptions/:id/otp/send` | JWT | Send OTP (printed to console) |
| POST | `/api/subscriptions/:id/otp/verify` | JWT | Verify OTP → activate subscription |
| GET | `/api/subscriptions/:id` | JWT | Get transaction status |
| GET | `/api/subscriptions/active` | JWT | Get user's active subscription |
| GET | `/api/health` | No | Health check |

## Project Structure

```
project/
├── server/                    # Express backend
│   ├── index.js               # App entry point (port 3001)
│   ├── store.js               # In-memory store (users + transactions + OTPs)
│   ├── middleware/auth.js     # JWT auth middleware
│   └── routes/
│       ├── auth.js            # Register, login, me
│       └── subscriptions.js   # Payment + OTP state machine
└── src/                       # React frontend
    ├── lib/apiClient.ts        # Axios instance with JWT header
    ├── context/AuthContext.tsx # Custom JWT-based auth context
    ├── pages/
    │   ├── Plans/PlansPage.tsx     # Plan selection UI
    │   ├── Payment/PaymentPage.tsx # OTP verification UI
    │   └── Profile/ProfilePage.tsx # Subscription status
    └── components/Navbar/BrowseNavbar.tsx  # Plans link added
```
