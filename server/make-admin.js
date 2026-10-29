require('dotenv').config();
const prisma = require('./lib/prisma');

const email = process.argv[2];
if (!email) {
  console.log('Usage: node make-admin.js <email>');
  process.exit(1);
}

prisma.user
  .update({ where: { email }, data: { role: 'ADMIN' } })
  .then((u) => console.log(u.email, 'is now', u.role))
  .catch(() => console.log('No user with that email'))
  .finally(() => prisma.$disconnect());