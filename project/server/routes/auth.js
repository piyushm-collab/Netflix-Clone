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
