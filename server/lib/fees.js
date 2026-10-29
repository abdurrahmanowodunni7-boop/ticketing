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

module.exports = { serviceFeeFor };