// Seeds one demo login per role, for portfolio visitors to sign in as without
// registering. isSystem: true — protected from edit/delete and exempt from
// the visitor-data TTL cleanup job (see AdminService.purgeExpiredVisitorData).
//
// Run: pnpm --filter api db:seed:demo

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;
const DEMO_PASSWORD = 'Demo@1234';

const DEMO_ACCOUNTS = [
  {
    role: 'CUSTOMER',
    email: 'demo.customer@dailybasket.app',
    firstName: 'Demo',
    lastName: 'Customer',
  },
  {
    role: 'DELIVERY_PARTNER',
    email: 'demo.delivery@dailybasket.app',
    firstName: 'Demo',
    lastName: 'Delivery',
  },
  {
    role: 'ADMIN',
    email: 'demo.admin@dailybasket.app',
    firstName: 'Demo',
    lastName: 'Admin',
  },
  {
    role: 'SUPER_ADMIN',
    email: 'demo.superadmin@dailybasket.app',
    firstName: 'Demo',
    lastName: 'SuperAdmin',
  },
];

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  for (const account of DEMO_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        role: account.role,
        isSystem: true,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        passwordHash,
        role: account.role,
        status: 'ACTIVE',
        isSystem: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Seeded ${account.role} demo account: ${account.email}`);

    // Demo delivery partner needs an ACTIVE DeliveryPartner profile to be
    // usable right away — a real partner would go through admin
    // approval/activation instead of starting ACTIVE.
    if (account.role === 'DELIVERY_PARTNER') {
      await prisma.deliveryPartner.upsert({
        where: { userId: user.id },
        update: { status: 'ACTIVE' },
        create: { userId: user.id, status: 'ACTIVE' },
      });
      console.log('Seeded DeliveryPartner profile for demo delivery account');
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
