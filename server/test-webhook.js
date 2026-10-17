require('dotenv').config();
const crypto = require('crypto');

const reference = process.argv[2];
const amount = Number(process.argv[3]);

if (!reference || !amount) {
  console.log('Usage: node test-webhook.js <reference> <amountInKobo>');
  process.exit(1);
}

const body = JSON.stringify({
  event: 'charge.success',
  data: { reference, amount, status: 'success' },
});

const signature = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
  .update(body)
  .digest('hex');

fetch('http://localhost:4000/webhooks/paystack', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
  body,
}).then((res) => console.log('Server replied with status', res.status));
