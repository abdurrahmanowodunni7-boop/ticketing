const crypto = require('crypto');
const prisma = require('./prisma');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function encryptToken(token) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64url')).join('.');
}

// Marks an order paid and creates its tickets. Safe to call more than once.
async function fulfillOrder(reference, paidKobo, payload) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { paystackReference: reference },
      include: { items: true },
    });
    if (!order) return { ok: false, reason: 'NOT_FOUND' };
    if (order.status === 'PAID') return { ok: true, orderId: order.id, already: true };

    if (paidKobo !== order.totalKobo) {
      console.error('Amount mismatch for', reference, paidKobo, order.totalKobo);
      return { ok: false, reason: 'AMOUNT_MISMATCH' };
    }

    // Only one caller can win this update, so tickets are never created twice.
    const won = await tx.order.updateMany({
      where: { id: order.id, status: { in: ['PENDING', 'EXPIRED'] } },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (won.count === 0) return { ok: true, orderId: order.id, already: true };

    await tx.paymentEvent.upsert({
      where: { providerRef: reference },
      update: {},
      create: { providerRef: reference, eventType: 'charge.success', payload: payload || {} },
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
            qrTokenEnc: encryptToken(token),
          },
        });
      }
    }
    return { ok: true, orderId: order.id };
  });
}

module.exports = { fulfillOrder };