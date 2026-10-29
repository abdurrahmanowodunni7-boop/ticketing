require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./lib/prisma');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhooks');
const ticketRoutes = require('./routes/tickets');
const scanRoutes = require('./routes/scan');
const bankingRoutes = require('./routes/banking');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(helmet());
app.use(cors());

// Webhooks first: they need the raw request body.
app.use('/webhooks', webhookRoutes);

app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});

app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/orders', orderRoutes);
app.use('/payments', paymentRoutes);
app.use('/tickets', ticketRoutes);
app.use('/scan', scanRoutes);
app.use('/banking', bankingRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.on('error', (err) => {
  console.error('Server failed to start:', err.message);
  process.exit(1);
});