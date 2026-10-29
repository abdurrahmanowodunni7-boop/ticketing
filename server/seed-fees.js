require('dotenv').config();
const prisma = require('./lib/prisma');

async function main() {
  await prisma.feeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, percent: 5 },
  });

  // Amounts are in kobo: 500000 kobo = ₦5,000
  const tiers = [
    { upToKobo: 500000, feeKobo: 50000 },     // up to ₦5,000   -> ₦500
    { upToKobo: 1000000, feeKobo: 70000 },    // up to ₦10,000  -> ₦700
    { upToKobo: 2000000, feeKobo: 100000 },   // up to ₦20,000  -> ₦1,000
    { upToKobo: 5000000, feeKobo: 150000 },   // up to ₦50,000  -> ₦1,500
  ];
  for (const t of tiers) {
    await prisma.feeTier.upsert({
      where: { upToKobo: t.upToKobo },
      update: { feeKobo: t.feeKobo },
      create: t,
    });
  }
  console.log('Fee settings and tiers saved');
}

main().finally(() => prisma.$disconnect());