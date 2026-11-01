// ---- Paystack's charges (check their pricing page and edit if they change) ----
const PAYSTACK_PERCENT = 1.5;          // % of the amount the customer pays
const PAYSTACK_FLAT_KOBO = 10000;      // ₦100
const FLAT_WAIVED_BELOW_KOBO = 250000; // flat fee waived under ₦2,500
const PAYSTACK_CAP_KOBO = 200000;      // fee never exceeds ₦2,000

// Works out the service fee the customer pays on top of the ticket price.
// `db` is the Prisma client (or a transaction). `lines` look like
// [{ unitKobo: 500000, quantity: 2 }].
async function serviceFeeFor(db, feeMethod, lines) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitKobo * l.quantity, 0);
  if (subtotal === 0) return 0;

  if (feeMethod === 'FIXED_TIERS') {
    const tiers = await db.feeTier.findMany({ orderBy: { upToKobo: 'asc' } });
    if (tiers.length === 0) throw new Error('NO_FEE_TIERS');

    let fee = 0;
    for (const l of lines) {
      if (l.unitKobo === 0) continue;
      // Smallest tier that covers this price; above the top tier, use the top tier.
      const tier = tiers.find((t) => l.unitKobo <= t.upToKobo) || tiers[tiers.length - 1];
      fee += tier.feeKobo * l.quantity; // fixed fee is per ticket
    }
    return fee;
  }

  const settings = await db.feeSettings.findUnique({ where: { id: 1 } });
  const percent = settings ? settings.percent : 5;
  return Math.round((subtotal * percent) / 100);
}

// Paystack's fee, grossed up so that after Paystack takes its cut,
// exactly `netKobo` (ticket price + service fee) is left.
function processingFeeFor(netKobo) {
  if (netKobo <= 0) return 0;
  const rate = PAYSTACK_PERCENT / 100;

  let total = netKobo / (1 - rate); // no flat fee
  if (total >= FLAT_WAIVED_BELOW_KOBO) {
    total = (netKobo + PAYSTACK_FLAT_KOBO) / (1 - rate);
  }
  if (total * rate + (total >= FLAT_WAIVED_BELOW_KOBO ? PAYSTACK_FLAT_KOBO : 0) > PAYSTACK_CAP_KOBO) {
    total = netKobo + PAYSTACK_CAP_KOBO;
  }
  return Math.ceil(total) - netKobo; // round up so you never lose a kobo
}

module.exports = { serviceFeeFor, processingFeeFor };