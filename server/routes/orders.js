const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { serviceFeeFor, processingFeeFor } = require('../lib/fees');

const router = express.Router();

const HOLD_MINUTES = 15;
const MAX_PER_ORDER = 10;

const orderSchema = z.object({
  eventId: z.string().min(1),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().min(1).max(MAX_PER_ORDER),
      })
    )
    .min(1)
    .max(10),
});

function mergeItems(items) {
  const merged = {};
  for (const item of items) {
    merged[item.ticketTypeId] = (merged[item.ticketTypeId] || 0) + item.quantity;
  }
  return merged;
}

// ---------- Price preview (no tickets held) ----------
router.post('/quote', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { eventId } = parsed.data;
  const merged = mergeItems(parsed.data.items);
  const ids = Object.keys(merged);
  const totalQty = Object.values(merged).reduce((a, b) => a + b, 0);
  if (totalQty > MAX_PER_ORDER) {
    return res.status(400).json({ error: `Maximum ${MAX_PER_ORDER} tickets per order` });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status !== 'PUBLISHED') {
    return res.status(404).json({ error: 'Event not available' });
  }
  const types = await prisma.ticketType.findMany({ where: { id: { in: ids }, eventId } });
  if (types.length !== ids.length) {
    return res.status(400).json({ error: 'Invalid ticket type' });
  }

  const lines = types.map((t) => ({ unitKobo: t.priceKobo, quantity: merged[t.id] }));
  const subtotalKobo = lines.reduce((s, l) => s + l.unitKobo * l.quantity, 0);

  try {
    const serviceFeeKobo = await serviceFeeFor(prisma, event.feeMethod, lines);
    const processingFeeKobo = processingFeeFor(subtotalKobo + serviceFeeKobo);
    res.json({
      feeMethod: event.feeMethod,
      subtotalKobo,
      serviceFeeKobo,
      processingFeeKobo,
      totalKobo: subtotalKobo + serviceFeeKobo + processingFeeKobo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not calculate the price' });
  }
});

// ---------- Create an order and hold the tickets (login required) ----------
router.post('/', requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { eventId } = parsed.data;

  const buyer = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!buyer) return res.status(401).json({ error: 'Please log in again' });

  const merged = mergeItems(parsed.data.items);
  const ids = Object.keys(merged);
  const totalQty = Object.values(merged).reduce((a, b) => a + b, 0);
  if (totalQty > MAX_PER_ORDER) {
    return res.status(400).json({ error: `Maximum ${MAX_PER_ORDER} tickets per order` });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Lock these ticket types so two buyers can't grab the last tickets together.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "TicketType" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`
      );

      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event || event.status !== 'PUBLISHED') {
        throw new Error('EVENT_UNAVAILABLE');
      }

      const types = await tx.ticketType.findMany({
        where: { id: { in: ids }, eventId },
      });
      if (types.length !== ids.length) throw new Error('BAD_TICKET_TYPE');

      const now = new Date();
      let subtotalKobo = 0;
      const lines = [];

      for (const t of types) {
        const wanted = merged[t.id];

        if ((t.saleStarts && t.saleStarts > now) || (t.saleEnds && t.saleEnds < now)) {
          throw new Error('SALE_CLOSED:' + t.name);
        }

        const sold = await tx.ticket.count({
          where: { ticketTypeId: t.id, status: 'VALID' },
        });
        const held = await tx.orderItem.aggregate({
          _sum: { quantity: true },
          where: {
            ticketTypeId: t.id,
            order: { status: 'PENDING', expiresAt: { gt: now } },
          },
        });
        const available = t.quantity - sold - (held._sum.quantity || 0);
        if (wanted > available) {
          throw new Error('NOT_ENOUGH:' + t.name + ':' + Math.max(0, available));
        }

        subtotalKobo += t.priceKobo * wanted;
        lines.push({ ticketTypeId: t.id, quantity: wanted, unitKobo: t.priceKobo });
      }

      if (subtotalKobo === 0) throw new Error('FREE_NOT_SUPPORTED');

      const serviceFeeKobo = await serviceFeeFor(tx, event.feeMethod, lines);
      const processingFeeKobo = processingFeeFor(subtotalKobo + serviceFeeKobo);

      return tx.order.create({
        data: {
          userId: buyer.id,
          eventId,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          subtotalKobo,
          serviceFeeKobo,
          processingFeeKobo,
          totalKobo: subtotalKobo + serviceFeeKobo + processingFeeKobo,
          status: 'PENDING',
          paystackReference: 'TKT-' + crypto.randomBytes(12).toString('hex'),
          expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
          items: { create: lines },
        },
        include: { items: true },
      });
    });

    res.status(201).json({
      order: {
        id: order.id,
        reference: order.paystackReference,
        subtotalKobo: order.subtotalKobo,
        serviceFeeKobo: order.serviceFeeKobo,
        processingFeeKobo: order.processingFeeKobo,
        totalKobo: order.totalKobo,
        expiresAt: order.expiresAt,
        items: order.items,
      },
    });
  } catch (err) {
    const msg = String(err.message);
    if (msg === 'EVENT_UNAVAILABLE') return res.status(404).json({ error: 'Event not available' });
    if (msg === 'BAD_TICKET_TYPE') return res.status(400).json({ error: 'Invalid ticket type' });
    if (msg === 'FREE_NOT_SUPPORTED') return res.status(400).json({ error: 'Free tickets are not supported yet' });
    if (msg.startsWith('SALE_CLOSED:')) {
      return res.status(400).json({ error: `Sales are closed for ${msg.split(':')[1]}` });
    }
    if (msg.startsWith('NOT_ENOUGH:')) {
      const [, name, left] = msg.split(':');
      return res.status(409).json({ error: `Only ${left} ${name} ticket(s) left` });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not create order' });
  }
});

module.exports = router;