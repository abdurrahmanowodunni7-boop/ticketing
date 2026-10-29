const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

// See the current fee settings.
router.get('/fees', async (req, res) => {
  const settings = await prisma.feeSettings.findUnique({ where: { id: 1 } });
  const tiers = await prisma.feeTier.findMany({ orderBy: { upToKobo: 'asc' } });
  res.json({ percent: settings ? settings.percent : 5, tiers });
});

// Change the percentage fee.
router.put('/fees/percent', async (req, res) => {
  const parsed = z.object({ percent: z.number().min(0).max(30) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Percent must be a number from 0 to 30' });
  }
  const settings = await prisma.feeSettings.upsert({
    where: { id: 1 },
    update: { percent: parsed.data.percent },
    create: { id: 1, percent: parsed.data.percent },
  });
  res.json({ percent: settings.percent });
});

// Replace all price-range tiers in one go.
const tiersSchema = z.object({
  tiers: z
    .array(
      z.object({
        upToKobo: z.number().int().min(1),
        feeKobo: z.number().int().min(0),
      })
    )
    .min(1)
    .max(30),
});

router.put('/fees/tiers', async (req, res) => {
  const parsed = tiersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid tiers', details: parsed.error.issues });
  }
  const ups = parsed.data.tiers.map((t) => t.upToKobo);
  if (new Set(ups).size !== ups.length) {
    return res.status(400).json({ error: 'Each tier needs a different upToKobo' });
  }

  await prisma.$transaction([
    prisma.feeTier.deleteMany(),
    prisma.feeTier.createMany({ data: parsed.data.tiers }),
  ]);
  const tiers = await prisma.feeTier.findMany({ orderBy: { upToKobo: 'asc' } });
  res.json({ tiers });
});

// Choose the fee method for one event.
router.patch('/events/:id/fee-method', async (req, res) => {
  const parsed = z.object({ feeMethod: z.enum(['PERCENTAGE', 'FIXED_TIERS']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid fee method' });

  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { feeMethod: parsed.data.feeMethod },
  });
  res.json({ id: updated.id, title: updated.title, feeMethod: updated.feeMethod });
});

module.exports = router;
