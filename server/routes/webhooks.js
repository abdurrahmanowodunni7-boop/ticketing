const crypto = require('crypto');
const express = require('express');
const { fulfillOrder } = require('../lib/fulfill');

const router = express.Router();

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
  if (event.event !== 'charge.success') return res.sendStatus(200);

  try {
    await fulfillOrder(event.data.reference, event.data.amount, event.data);
  } catch (err) {
    console.error('Webhook error:', err);
    return res.sendStatus(500); // Paystack will retry
  }
  res.sendStatus(200);
});

module.exports = router;