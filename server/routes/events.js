const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const eventSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(5000).optional(),
  venue: z.string().trim().min(2).max(200),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  reentryEnabled: z.boolean().default(false),
  maxReentries: z.number().int().min(0).max(20).default(2),
});

const ticketTypeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  priceKobo: z.number().int().min(0),
  quantity: z.number().int().min(1).max(100000),
  saleStarts: z.coerce.date().optional(),
  saleEnds: z.coerce.date().optional(),
});

// Loads an event and checks the logged-in organizer owns it.
async function loadOwnedEvent(req, res) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return null;
  }
  if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'This is not your event' });
    return null;
  }
  return event;
}

// ---------- Public ----------

router.get('/', async (req, res) => {
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED', startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true, title: true, venue: true, startsAt: true, endsAt: true,
      description: true, reentryEnabled: true,
    },
  });
  res.json({ events });
});

router.get('/:id', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { ticketTypes: { orderBy: { priceKobo: 'asc' } } },
  });
  if (!event || event.status !== 'PUBLISHED') {
    return res.status(404).json({ error: 'Event not found' });
  }

  const sold = await prisma.ticket.groupBy({
    by: ['ticketTypeId'],
    where: { eventId: event.id, status: 'VALID' },
    _count: { _all: true },
  });
  const soldMap = Object.fromEntries(sold.map((s) => [s.ticketTypeId, s._count._all]));

  const ticketTypes = event.ticketTypes.map((t) => ({
    id: t.id,
    name: t.name,
    priceKobo: t.priceKobo,
    quantity: t.quantity,
    remaining: Math.max(0, t.quantity - (soldMap[t.id] || 0)),
    saleStarts: t.saleStarts,
    saleEnds: t.saleEnds,
  }));

  const { organizerId, ...publicEvent } = event;
  res.json({ event: { ...publicEvent, ticketTypes } });
});

// ---------- Organizer ----------

router.get('/mine/list', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const events = await prisma.event.findMany({
    where: { organizerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ events });
});

router.post('/', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const event = await prisma.event.create({
    data: { ...parsed.data, organizerId: req.user.id },
  });
  res.status(201).json({ event });
});

router.patch('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const existing = await loadOwnedEvent(req, res);
  if (!existing) return;

  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const event = await prisma.event.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  res.json({ event });
});

router.post('/:id/publish', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const existing = await loadOwnedEvent(req, res);
  if (!existing) return;

  const count = await prisma.ticketType.count({ where: { eventId: existing.id } });
  if (count === 0) {
    return res.status(400).json({ error: 'Add at least one ticket type before publishing' });
  }
  const event = await prisma.event.update({
    where: { id: existing.id },
    data: { status: 'PUBLISHED' },
  });
  res.json({ event });
});

router.post('/:id/unpublish', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const existing = await loadOwnedEvent(req, res);
  if (!existing) return;

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: { status: 'DRAFT' },
  });
  res.json({ event });
});

router.post('/:id/ticket-types', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const existing = await loadOwnedEvent(req, res);
  if (!existing) return;

  const parsed = ticketTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const ticketType = await prisma.ticketType.create({
    data: { ...parsed.data, eventId: existing.id },
  });
  res.status(201).json({ ticketType });
});

module.exports = router;