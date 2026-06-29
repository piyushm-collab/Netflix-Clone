const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'], credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[Payment Auth Backend] running on http://localhost:${PORT}`));
