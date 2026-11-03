const prisma = require('./prisma');

// Unpaid orders become EXPIRED one hour after their 15-minute hold ends.
// The extra hour is a grace period for slow payments (bank transfer, USSD).
async function expireOldOrders() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const result = await prisma.order.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: cutoff } },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) console.log(`Expired ${result.count} unpaid order(s)`);
}

function startCleanup() {
  const run = () => expireOldOrders().catch((err) => console.error('Cleanup failed:', err.message));
  run();
  setInterval(run, 10 * 60 * 1000); // every 10 minutes
}

module.exports = { startCleanup };