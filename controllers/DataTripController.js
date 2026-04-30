const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DataTripController = {
  // Get All Data Trip
  getAll: async (req, res) => {
    try {
      const data = await prisma.dataTrip.findMany({
        orderBy: { id: 'desc' }
      });
      res.json({ ok: true, data });
    } catch (error) {
      console.error('Error fetching data trip:', error);
      res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
  },

  // Get Data Trip by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const data = await prisma.dataTrip.findUnique({
        where: { id: parseInt(id) }
      });
      if (!data) return res.status(404).json({ ok: false, error: 'Data not found' });
      res.json({ ok: true, data });
    } catch (error) {
      console.error('Error fetching data trip by id:', error);
      res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
  },

  // Insert Data Trip
  create: async (req, res) => {
    try {
      const {
        idAlat,
        trip,
        tanggal,
        lokasiStart,
        lokasiFinish,
        namaOperator,
        idOperator,
        jenisMuatan,
        waktuStart,
        waktuFinish,
        durasi
      } = req.body;

      const newData = await prisma.dataTrip.create({
        data: {
          idAlat: idAlat?.toString() || null,
          trip: trip?.toString() || null,
          tanggal: tanggal?.toString() || null,
          lokasiStart: lokasiStart?.toString() || null,
          lokasiFinish: lokasiFinish?.toString() || null,
          namaOperator: namaOperator?.toString() || null,
          idOperator: idOperator?.toString() || null,
          jenisMuatan: jenisMuatan?.toString() || null,
          waktuStart: waktuStart?.toString() || null,
          waktuFinish: waktuFinish?.toString() || null,
          durasi: durasi?.toString() || null,
        }
      });

      res.status(201).json({ ok: true, data: newData });
    } catch (error) {
      console.error('Error creating data trip:', error);
      res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
  }
};

module.exports = DataTripController;
