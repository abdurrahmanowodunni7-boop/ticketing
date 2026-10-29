const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const PAYSTACK_URL = 'https://api.paystack.co';

function psHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Nigerian banks, for a dropdown.
router.get('/banks', requireAuth, async (req, res) => {
  try {
    const r = await fetch(`${PAYSTACK_URL}/bank?country=nigeria&perPage=100`, { headers: psHeaders() });
    const d = await r.json();
    if (!r.ok || !d.status) return res.status(502).json({ error: 'Could not load banks' });
    res.json({ banks: d.data.map((b) => ({ name: b.name, code: b.code })) });
  } catch {
    res.status(502).json({ error: 'Could not reach Paystack' });
  }
});

// Is payout set up?
router.get('/me', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({
    ready: !!u.subaccountCode,
    bankName: u.bankName,
    accountName: u.accountName,
    accountLast4: u.accountLast4,
  });
});

const schema = z.object({
  bankCode: z.string().trim().min(2).max(10),
  accountNumber: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
});

// Organizer sets up their payout account.
router.post('/subaccount', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { bankCode, accountNumber } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.subaccountCode) {
    return res.status(409).json({ error: 'Payout account already set up' });
  }

  try {
    // 1. Check the account exists and get the real account holder name.
    const rr = await fetch(
      `${PAYSTACK_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: psHeaders() }
    );
    const rd = await rr.json();
    if (!rr.ok || !rd.status) {
      console.error('Resolve error:', rd);
      return res.status(400).json({ error: 'Could not verify that bank account' });
    }

    // 2. Create the Paystack subaccount. We set the fee per payment instead.
    const sr = await fetch(`${PAYSTACK_URL}/subaccount`, {
      method: 'POST',
      headers: psHeaders(),
      body: JSON.stringify({
        business_name: user.name,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: 0,
      }),
    });
    const sd = await sr.json();
    if (!sr.ok || !sd.status) {
      console.error('Subaccount error:', sd);
      return res.status(502).json({ error: 'Could not create payout account' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        subaccountCode: sd.data.subaccount_code,
        bankName: sd.data.settlement_bank,
        accountName: rd.data.account_name,
        accountLast4: accountNumber.slice(-4),
      },
    });
    res.status(201).json({
      ready: true,
      bankName: updated.bankName,
      accountName: updated.accountName,
      accountLast4: updated.accountLast4,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not reach Paystack' });
  }
});

module.exports = router;