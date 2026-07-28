/* eslint-disable no-console */
import { PlanTier, PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Development seed.
 *
 * Creates the accounts needed to exercise the plan tiers locally. It is
 * idempotent (`upsert`) and refuses to run against a production database — the
 * platform has no demo content to seed beyond these logins.
 *
 * Usage: `npm run db:seed`
 */

const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    email: 'admin@hexaconverter.local',
    name: 'Admin User',
    role: UserRole.ADMIN,
    plan: PlanTier.BUSINESS,
  },
  {
    email: 'pro@hexaconverter.local',
    name: 'Pro User',
    role: UserRole.USER,
    plan: PlanTier.PRO,
  },
  {
    email: 'free@hexaconverter.local',
    name: 'Free User',
    role: UserRole.USER,
    plan: PlanTier.FREE,
  },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const password = process.env.SEED_PASSWORD ?? 'development-password-1';
  const passwordHash = await bcrypt.hash(password, 12);

  for (const account of ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role, plan: account.plan },
      create: { ...account, passwordHash },
      select: { id: true, email: true, plan: true },
    });

    console.log(`seeded ${user.email} (${user.plan})`);
  }

  console.log(`\nAll seeded accounts use the password: ${password}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
