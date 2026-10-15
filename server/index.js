require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./lib/prisma');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');

const app = express();

app.use(helmet());
app.use(cors());
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port 4000`));