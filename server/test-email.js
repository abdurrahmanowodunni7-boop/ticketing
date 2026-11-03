require('dotenv').config();
const nodemailer = require('nodemailer');

const to = process.argv[2];
if (!to) {
  console.log('Usage: node test-email.js your@email.com');
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT || 587);
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  family: 4,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transport
  .sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'Ticketing test email',
    text: 'If you can read this, your email settings work.',
  })
  .then((info) => console.log('Sent. Server said:', info.response))
  .catch((err) => console.log('FAILED:', err.message));