const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dummy data log...');
  
  await prisma.dataLog.create({
    data: {
      idAlat: 'ABC-DT-001',
      noPol: 'DD 3001 ST',
      jenisAlat: 'DUMP TRUCK 10 RODA',
      merekAlat: 'HOWO',
      trip: 'ABC-DT-001-2026-12-2',
      latitude: '-5.147665',
      longitude: '119.432732',
      kecepatan: 45.5,
      jenisMuatan: 'KOSONG',
      volumeFuel: 120.5,
      konsumsiFuel: 12.3,
      anomaliStatusFuel: 'NORMAL',
      fuelMasuk: 0,
      statusAlat: 'START',
      start: '00:07',
      rentangWaktuAktif: '00:07-00:09',
      durasiAktif: '2 Menit',
      rentangWaktuPassif: '-',
      durasiPassif: '-',
      mati: '-',
      namaOperator: 'Budi Santoso',
      idOperator: 'OP-001',
      statusTrip: 'TERBUKA',
    }
  });

  await prisma.dataLog.create({
    data: {
      idAlat: 'ABC-DT-002',
      noPol: 'DD 4002 XY',
      jenisAlat: 'EXCAVATOR',
      merekAlat: 'KOMATSU',
      trip: 'ABC-EX-002-2026-12-2',
      latitude: '-5.148000',
      longitude: '119.433000',
      kecepatan: 0,
      jenisMuatan: 'OVERBURDEN (OB)',
      volumeFuel: 450.0,
      konsumsiFuel: 20.5,
      anomaliStatusFuel: 'NORMAL',
      fuelMasuk: 50.0,
      statusAlat: 'AKTIF',
      start: '08:00',
      rentangWaktuAktif: '08:00-12:00',
      durasiAktif: '4 Jam',
      rentangWaktuPassif: '12:00-13:00',
      durasiPassif: '1 Jam',
      mati: '-',
      namaOperator: 'Andi',
      idOperator: 'OP-002',
      statusTrip: 'TERTUTUP',
    }
  });

  console.log('Dummy data successfully inserted!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
