import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_AREA_CONFIG } from '../src/utils/areas.js';
import { DEFAULT_TEMPLATES } from '../src/utils/draft.js';
import { DEED_TYPE_NAMES } from '../src/utils/deedTypes.js';

const prisma = new PrismaClient();

export async function seedOffice(db: PrismaClient, name = 'Dolil OS Demo Office') {
  const office = await db.office.create({ data: { name, areaConversions: DEFAULT_AREA_CONFIG as any } });
  // Templates are seeded UNAPPROVED: a qualified reviewer must approve each one in Settings before final use.
  for (const deedType of DEED_TYPE_NAMES) {
    await db.deedTemplate.create({
      data: { officeId: office.id, deedType, version: 1, name: `${deedType} (starter)`, body: DEFAULT_TEMPLATES[deedType] },
    });
  }
  return office;
}

/** Offices seeded before the Bangladesh document format get new narrative-only template versions (unapproved). */
export async function upgradeTemplates(db: PrismaClient, officeId: string) {
  for (const deedType of DEED_TYPE_NAMES) {
    const latest = await db.deedTemplate.findFirst({ where: { officeId, deedType }, orderBy: { version: 'desc' } });
    if (latest && latest.body.includes('.list}}')) {
      await db.deedTemplate.create({
        data: { officeId, deedType, version: latest.version + 1, name: `${deedType} (Bangladesh format, starter)`, body: DEFAULT_TEMPLATES[deedType] },
      });
      console.log(`Added narrative template v${latest.version + 1} for ${deedType} (unapproved)`);
    }
  }
}

async function main() {
  const email = 'admin@dolilos.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await upgradeTemplates(prisma, existing.officeId);
    console.log('Seed data already present. Login: admin@dolilos.local / ChangeMe123!');
    return;
  }
  const office = await seedOffice(prisma);
  await prisma.user.create({
    data: {
      officeId: office.id,
      name: 'Dolil OS Owner',
      email,
      passwordHash: await bcrypt.hash('ChangeMe123!', 12),
      role: 'OWNER',
    },
  });
  console.log('Seed complete. Login: admin@dolilos.local / ChangeMe123!');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main().finally(() => prisma.$disconnect());
}
