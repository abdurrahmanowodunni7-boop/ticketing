require('dotenv').config();

const reference = process.argv[2];
const amount = Number(process.argv[3]);

if (!reference || !amount) {
  console.log('Usage: node test-fake-webhook.js <reference> <amountInKobo>');
  process.exit(1);
}

const body = JSON.stringify({
  event: 'charge.success',
  data: { reference, amount, status: 'success' },
});

fetch('http://localhost:4000/webhooks/paystack', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-paystack-signature': 'this-is-a-fake-signature',
  },
  body,
}).then((res) => console.log('Server replied with status', res.status));