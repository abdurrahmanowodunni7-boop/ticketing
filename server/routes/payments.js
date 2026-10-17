const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

const PAYSTACK_URL = 'https://api.paystack.co';

// Start a payment for an existing pending order.
router.post('/initialize', async (req, res) => {
  const { orderId, callbackUrl } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId is required' });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING') {
    return res.status(409).json({ error: 'This order is no longer payable' });
  }
  if (order.expiresAt < new Date()) {
    return res.status(410).json({ error: 'Your ticket hold has expired. Please start again.' });
  }

  try {
    const response = await fetch(`${PAYSTACK_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: order.buyerEmail,
        amount: order.totalKobo, // Paystack expects kobo
        reference: order.paystackReference,
        callback_url: callbackUrl || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.status) {
      console.error('Paystack error:', data);
      return res.status(502).json({ error: 'Could not start payment' });
    }
    res.json({
      authorizationUrl: data.data.authorization_url,
      reference: order.paystackReference,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not reach Paystack' });
  }
});

module.exports = router;