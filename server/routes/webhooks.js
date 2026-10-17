const crypto = require('crypto');
const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Paystack sends raw JSON; we need the raw bytes to check the signature.
router.post('/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest('hex');

  if (!signature || signature !== expected) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());

  // Only successful charges matter here.
  if (event.event !== 'charge.success') {
    return res.sendStatus(200);
  }

  const reference = event.data.reference;

  try {
    await prisma.$transaction(async (tx) => {
      // Duplicate protection: providerRef is unique, so a repeat throws P2002.
      await tx.paymentEvent.create({
        data: { providerRef: reference, eventType: event.event, payload: event.data },
      });

      const order = await tx.order.findUnique({
        where: { paystackReference: reference },
        include: { items: true },
      });
      if (!order) return;
      if (order.status === 'PAID') return;

      // Amount must match what we expected.
      if (event.data.amount !== order.totalKobo) {
        console.error('Amount mismatch for', reference);
        return;
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      for (const item of order.items) {
        for (let i = 0; i < item.quantity; i++) {
          const token = crypto.randomBytes(32).toString('base64url');
          await tx.ticket.create({
            data: {
              orderId: order.id,
              eventId: order.eventId,
              ticketTypeId: item.ticketTypeId,
              attendeeName: order.buyerName,
              qrTokenHash: hashToken(token),
            },
          });
          // NOTE: the raw token is not stored. We deliver it by email in the next step.
        }
      }
    });
  } catch (err) {
    if (err.code === 'P2002') return res.sendStatus(200); // duplicate delivery
    console.error('Webhook error:', err);
    return res.sendStatus(500); // Paystack will retry
  }

  res.sendStatus(200);
});

module.exports = router;