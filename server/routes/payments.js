const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();
const PAYSTACK_URL = 'https://api.paystack.co';

router.post('/initialize', async (req, res) => {
  const { orderId, callbackUrl } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId is required' });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { event: { include: { organizer: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING') {
    return res.status(409).json({ error: 'This order is no longer payable' });
  }
  if (order.expiresAt < new Date()) {
    return res.status(410).json({ error: 'Your ticket hold has expired. Please start again.' });
  }

  const subaccount = order.event.organizer.subaccountCode;
  if (!subaccount) {
    return res.status(409).json({ error: 'This organizer has not set up payouts yet' });
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
        amount: order.totalKobo,                 // ticket price + service fee
        reference: order.paystackReference,
        callback_url: callbackUrl || undefined,
        subaccount,                              // organizer's payout account
        transaction_charge: order.serviceFeeKobo, // your share, in kobo
        bearer: 'account',                       // Paystack's fee comes out of your share
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