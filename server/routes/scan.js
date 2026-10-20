const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const scanSchema = z.object({
  eventId: z.string().min(1),
  token: z.string().trim().min(10).max(200),
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Can this user scan at this event?
async function canScan(user, event) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'ORGANIZER') return event.organizerId === user.id;
  if (user.role === 'SCANNER') {
    const a = await prisma.scannerAssignment.findUnique({
      where: { eventId_scannerId: { eventId: event.id, scannerId: user.id } },
    });
    return !!a;
  }
  return false;
}

router.post('/', requireAuth, requireRole('SCANNER', 'ORGANIZER', 'ADMIN'), async (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { eventId, token } = parsed.data;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!(await canScan(req.user, event))) {
    return res.status(403).json({ error: 'You are not allowed to scan at this event' });
  }

  async function log(ticketId, result) {
    await prisma.scanLog.create({
      data: { ticketId, eventId, scannerId: req.user.id, result },
    });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { qrTokenHash: hashToken(token) },
    include: { ticketType: { select: { name: true } } },
  });

  if (!ticket) {
    await log(null, 'INVALID');
    return res.json({ ok: false, result: 'INVALID', message: 'Ticket not recognised' });
  }

  const info = { attendeeName: ticket.attendeeName, type: ticket.ticketType.name };

  if (ticket.eventId !== eventId) {
    await log(ticket.id, 'WRONG_EVENT');
    return res.json({ ok: false, result: 'WRONG_EVENT', message: 'Ticket is for a different event', ...info });
  }

  if (ticket.status !== 'VALID') {
    await log(ticket.id, 'CANCELLED');
    return res.json({ ok: false, result: 'CANCELLED', message: 'Ticket is cancelled or refunded', ...info });
  }

  // Single atomic update: only one scan can ever win.
  const won = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: 'VALID', firstAdmittedAt: null },
    data: { firstAdmittedAt: new Date() },
  });

  if (won.count === 1) {
    await log(ticket.id, 'ADMITTED');
    return res.json({ ok: true, result: 'ADMITTED', message: 'Entry allowed', ...info });
  }

  const current = await prisma.ticket.findUnique({ where: { id: ticket.id } });
  await log(ticket.id, 'ALREADY_INSIDE');
  return res.json({
    ok: false,
    result: 'ALREADY_USED',
    message: 'Ticket already used',
    firstAdmittedAt: current.firstAdmittedAt,
    ...info,
  });
});

module.exports = router;