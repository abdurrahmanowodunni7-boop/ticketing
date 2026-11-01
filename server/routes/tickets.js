const crypto = require('crypto');
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function decryptToken(value) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
  const [iv, tag, enc] = value.split('.').map((s) => Buffer.from(s, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// All paid orders of the logged-in user, newest first.
router.get('/mine', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id, status: 'PAID' },
    orderBy: { paidAt: 'desc' },
    include: {
      event: { select: { title: true, venue: true, startsAt: true } },
      _count: { select: { tickets: true } },
    },
  });
  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      paidAt: o.paidAt,
      totalKobo: o.totalKobo,
      ticketCount: o._count.tickets,
      event: o.event,
    })),
  });
});

// The tickets of one order. Only its owner can see them.
router.get('/order/:orderId', requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: {
      event: { select: { title: true, venue: true, startsAt: true, reentryEnabled: true, maxReentries: true } },
      tickets: { include: { ticketType: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!order || (order.userId !== req.user.id && req.user.role !== 'ADMIN')) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (order.status !== 'PAID') {
    return res.status(409).json({ error: 'Payment not confirmed yet', status: order.status });
  }

  const tickets = order.tickets
    .filter((t) => t.qrTokenEnc)
    .map((t) => ({
      id: t.id,
      attendeeName: t.attendeeName,
      type: t.ticketType.name,
      status: t.status,
      used: !!t.firstAdmittedAt,
      qrToken: decryptToken(t.qrTokenEnc),
    }));

  res.json({ event: order.event, buyerName: order.buyerName, tickets });
});

module.exports = router;