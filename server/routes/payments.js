const express = require('express');
const prisma = require('../lib/prisma');
const { fulfillOrder } = require('../lib/fulfill');

const router = express.Router();
const PAYSTACK_URL = 'https://api.paystack.co';

function psHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

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
      headers: psHeaders(),
      body: JSON.stringify({
        email: order.buyerEmail,
        amount: order.totalKobo,
        reference: order.paystackReference,
        callback_url: callbackUrl || undefined,
        subaccount,
        transaction_charge: order.totalKobo - order.subtotalKobo, // service fee + processing fee
        bearer: 'account',
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.status) {
      console.error('Paystack error:', data);
      return res.status(502).json({ error: 'Could not start payment' });
    }
    res.json({ authorizationUrl: data.data.authorization_url, reference: order.paystackReference });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not reach Paystack' });
  }
});

// Asks Paystack directly whether the payment succeeded, then issues tickets.
router.get('/verify/:reference', async (req, res) => {
  const reference = req.params.reference;
  const order = await prisma.order.findUnique({ where: { paystackReference: reference } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'PAID') return res.json({ status: 'PAID', orderId: order.id });

  try {
    const r = await fetch(`${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: psHeaders(),
    });
    const d = await r.json();
    if (!r.ok || !d.status) return res.status(502).json({ error: 'Could not check the payment' });

    if (d.data.status !== 'success') return res.json({ status: 'PENDING' });

    const result = await fulfillOrder(reference, d.data.amount, d.data);
    if (!result.ok) return res.status(409).json({ error: 'Payment could not be matched to the order' });
    res.json({ status: 'PAID', orderId: result.orderId });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not reach Paystack' });
  }
});

module.exports = router;