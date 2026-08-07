const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const alat = await prisma.alat.findMany({take: 5});
    console.log(JSON.stringify(alat, null, 2));
}

main().catch(console.error).finally(()=> prisma.$disconnect());
