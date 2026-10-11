const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true }
  });
  console.log('CURRENT USERS IN DB:');
  console.log(JSON.stringify(users, null, 2));
}

check().finally(() => prisma.$disconnect());
