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
  if (status === 'CREATED') return 'INITIATED';
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

  console.log(`\n[OTP DEMO] transactionId=${req.params.id}  OTP=${otp}  (copy this into the UI)\n`);

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
