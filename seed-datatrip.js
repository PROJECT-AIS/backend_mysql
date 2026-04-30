const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dummy data trip...');
  
  await prisma.dataTrip.create({
    data: {
      idAlat: 'ABC-DT-001',
      trip: 'ABC-DT-001-2026-17-2',
      tanggal: '2/17/2026',
      lokasiStart: 'PIT SAMAENRE 1A',
      lokasiFinish: 'STOCKPILE BABARINA',
      namaOperator: 'Budi Santoso',
      idOperator: 'OP-001',
      jenisMuatan: 'KOSONG',
      waktuStart: '00.07',
      waktuFinish: '00.25',
      durasi: '18 Menit',
    }
  });

  await prisma.dataTrip.create({
    data: {
      idAlat: 'ABC-DT-001',
      trip: 'ABC-DT-001-2026-17-3',
      tanggal: '2/17/2026',
      lokasiStart: 'STOCKPILE BABARINA',
      lokasiFinish: 'PIT SAMAENRE 1B',
      namaOperator: 'Budi Santoso',
      idOperator: 'OP-001',
      jenisMuatan: 'LIMONITE ORE (LIM)',
      waktuStart: '00.30',
      waktuFinish: '00.55',
      durasi: '25 Menit',
    }
  });

  console.log('Dummy data trip successfully inserted!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
