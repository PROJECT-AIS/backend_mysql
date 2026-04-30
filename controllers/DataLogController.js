const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAll = async (req, res) => {
  try {
    const data = await prisma.dataLog.findMany({
      orderBy: { waktu: 'desc' }
    });
    res.json({ ok: true, data });
  } catch (e) {
    console.error('[DataLog] Error fetching data:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

const create = async (req, res) => {
  try {
    const payload = req.body;
    
    // Parse numeric fields if they come as strings
    if (payload.kecepatan) payload.kecepatan = parseFloat(payload.kecepatan);
    if (payload.volumeFuel) payload.volumeFuel = parseFloat(payload.volumeFuel);
    if (payload.konsumsiFuel) payload.konsumsiFuel = parseFloat(payload.konsumsiFuel);
    if (payload.fuelMasuk) payload.fuelMasuk = parseFloat(payload.fuelMasuk);

    const newData = await prisma.dataLog.create({
      data: payload
    });
    res.status(201).json({ ok: true, data: newData });
  } catch (e) {
    console.error('[DataLog] Error creating data:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await prisma.dataLog.findUnique({
      where: { id: parseInt(id) }
    });
    if (!data) return res.status(404).json({ ok: false, error: 'Data log tidak ditemukan' });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

module.exports = {
  getAll,
  create,
  getById
};
