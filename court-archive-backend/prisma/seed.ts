import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const petugasHash = await bcrypt.hash('petugas123', 10);

  await prisma.user.upsert({
    where: { username: 'admin1' },
    update: {},
    create: { username: 'admin1', passwordHash: adminHash, role: 'admin' },
  });

  await prisma.user.upsert({
    where: { username: 'petugas1' },
    update: {},
    create: { username: 'petugas1', passwordHash: petugasHash, role: 'petugas' },
  });
}

main()
  .then(async () => {
    await pool.end();
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    await prisma.$disconnect();
    process.exit(1);
  });
