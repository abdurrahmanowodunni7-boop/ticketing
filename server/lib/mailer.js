const nodemailer = require('nodemailer');
const prisma = require('./prisma');

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendTicketEmail(orderId) {
  const t = getTransport();
  if (!t) {
    console.log('Email skipped: SMTP settings are missing');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      event: { select: { title: true, venue: true, startsAt: true } },
      _count: { select: { tickets: true } },
    },
  });
  if (!order) return;

  const link = `${process.env.APP_URL || 'http://localhost:5173'}/tickets/${order.id}`;
  const when = order.event.startsAt.toLocaleString('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
  const count = order._count.tickets;
  const total = '₦' + (order.totalKobo / 100).toLocaleString('en-NG');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
      <h2 style="color:#7c3aed">Your tickets are ready</h2>
      <p>Hi ${esc(order.buyerName)}, your payment of ${total} was received.</p>
      <p><strong>${esc(order.event.title)}</strong><br>
         ${esc(order.event.venue)}<br>${esc(when)}<br>
         ${count} ticket${count === 1 ? '' : 's'}</p>
      <p><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">View my tickets</a></p>
      <p style="font-size:13px;color:#555">Log in with this email address to see your QR codes. Each ticket can be scanned once, so don't share the QR codes.</p>
    </div>`;

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: order.buyerEmail,
    subject: `Your tickets for ${order.event.title}`,
    html,
    text: `Your tickets for ${order.event.title} are ready: ${link}`,
  });
}

module.exports = { sendTicketEmail };