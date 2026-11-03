const bcrypt = require('bcryptjs');
const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('ORGANIZER', 'ADMIN'));

async function ownedEvent(req, res, eventId) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
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

const createSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100).optional(),
});

// Create a scanner login (or reuse an existing scanner) and assign it to an event.
router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { eventId, name, email, password } = parsed.data;
  const event = await ownedEvent(req, res, eventId);
  if (!event) return;

  let user = await prisma.user.findUnique({ where: { email } });
  if (user && user.role !== 'SCANNER') {
    return res.status(409).json({ error: 'That email belongs to a non-scanner account' });
  }
  if (!user) {
    if (!password) return res.status(400).json({ error: 'A password is required for a new scanner' });
    user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: 'SCANNER' },
    });
  }

  await prisma.scannerAssignment.upsert({
    where: { eventId_scannerId: { eventId, scannerId: user.id } },
    update: {},
    create: { eventId, scannerId: user.id },
  });
  res.status(201).json({ scanner: { id: user.id, name: user.name, email: user.email }, eventId });
});

// List scanners assigned to one of your events.
router.get('/', async (req, res) => {
  const eventId = String(req.query.eventId || '');
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  const event = await ownedEvent(req, res, eventId);
  if (!event) return;

  const rows = await prisma.scannerAssignment.findMany({
    where: { eventId },
    include: { scanner: { select: { id: true, name: true, email: true } } },
  });
  res.json({ scanners: rows.map((r) => r.scanner) });
});

// Remove a scanner from an event.
router.delete('/:eventId/:scannerId', async (req, res) => {
  const event = await ownedEvent(req, res, req.params.eventId);
  if (!event) return;
  await prisma.scannerAssignment.deleteMany({
    where: { eventId: event.id, scannerId: req.params.scannerId },
  });
  res.json({ removed: true });
});

module.exports = router;