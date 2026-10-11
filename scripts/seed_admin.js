const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = 'adminUAnursing';
  const email = 'adminuanursing@ua.edu.ph';
  const rawPassword = 'CONP2026-2027';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: username },
        { email: email }
      ]
    }
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: username,
        email: email,
        password: hashedPassword,
        name: 'Dean / UA Nursing Admin',
        role: 'ADMIN'
      }
    });
    console.log('SUCCESS: Admin user updated:', updated.username, updated.role);
  } else {
    const created = await prisma.user.create({
      data: {
        username: username,
        email: email,
        password: hashedPassword,
        name: 'Dean / UA Nursing Admin',
        role: 'ADMIN'
      }
    });
    console.log('SUCCESS: Admin user created:', created.username, created.role);
  }
}

main()
  .catch((e) => {
    console.error('Error seeding admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
