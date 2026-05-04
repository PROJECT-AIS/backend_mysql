const prisma = require('../prisma/client')
const path = require('path')
const fs = require('fs')

// ===================== ALAT =====================
exports.getAllAlat = async (req, res) => {
    try {
        const alat = await prisma.alat.findMany({
            orderBy: { createdAt: 'desc' }
        })

// ===================== ALAT =====================
exports.getAllAlat = async (req, res) => {
    try {
        const alat = await prisma.alat.findMany({
            orderBy: { createdAt: 'desc' }
        })
        res.json({ success: true, data: alat })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.getAlatById = async (req, res) => {
    try {
        const alat = await prisma.alat.findUnique({
            where: { id: parseInt(req.params.id) }
        })
        if (!alat) {
            return res.status(404).json({ success: false, message: 'Alat tidak ditemukan' })
        }
        res.json({ success: true, data: alat })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.createAlat = async (req, res) => {
    try {
        const { idFms, noUnit, jenisAlat, merk, kapasitasMuat, kapasitasTangki, tahunManufaktur, status } = req.body

        const alat = await prisma.alat.create({
            data: { 
                idFms, 
                noUnit, 
                jenisAlat, 
                merk, 
                kapasitasMuat: parseFloat(kapasitasMuat) || null,
                kapasitasTangki: parseInt(kapasitasTangki) || null,
                tahunManufaktur: parseInt(tahunManufaktur) || null,
                status: status || 'Aktif' 
            }
        })
        res.status(201).json({ success: true, data: alat })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.updateAlat = async (req, res) => {
    try {
        const { idFms, noUnit, jenisAlat, merk, kapasitasMuat, kapasitasTangki, tahunManufaktur, status } = req.body
        
        const updateData = { 
            idFms, 
            noUnit, 
            jenisAlat, 
            merk, 
            kapasitasMuat: parseFloat(kapasitasMuat) || null,
            kapasitasTangki: parseInt(kapasitasTangki) || null,
            tahunManufaktur: parseInt(tahunManufaktur) || null,
            status 
        }

        const alat = await prisma.alat.update({
            where: { id: parseInt(req.params.id) },
            data: updateData
        })
        res.json({ success: true, data: alat })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.deleteAlat = async (req, res) => {
    try {
        await prisma.alat.delete({
            where: { id: parseInt(req.params.id) }
        })
        res.json({ success: true, message: 'Alat berhasil dihapus' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ===================== OPERATOR =====================
exports.getAllOperator = async (req, res) => {
    try {
        const operator = await prisma.operatorNfc.findMany({
            orderBy: { createdAt: 'desc' }
        })
        res.json({ success: true, data: operator })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.getOperatorById = async (req, res) => {
    try {
        const operator = await prisma.operatorNfc.findUnique({
            where: { id: parseInt(req.params.id) }
        })
        if (!operator) {
            return res.status(404).json({ success: false, message: 'Operator tidak ditemukan' })
        }
        res.json({ success: true, data: operator })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.createOperator = async (req, res) => {
    try {
        const { idOperator, nama, noTelp, divisi, idCardNfc, jabatan, alamat } = req.body
        const operator = await prisma.operatorNfc.create({
            data: { idOperator, nama, noTelp, divisi, idCardNfc, jabatan, alamat }
        })
        res.status(201).json({ success: true, data: operator })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.updateOperator = async (req, res) => {
    try {
        const { idOperator, nama, noTelp, divisi, idCardNfc, jabatan, alamat } = req.body
        const operator = await prisma.operatorNfc.update({
            where: { id: parseInt(req.params.id) },
            data: { idOperator, nama, noTelp, divisi, idCardNfc, jabatan, alamat }
        })
        res.json({ success: true, data: operator })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.deleteOperator = async (req, res) => {
    try {
        await prisma.operatorNfc.delete({
            where: { id: parseInt(req.params.id) }
        })
        res.json({ success: true, message: 'Operator berhasil dihapus' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ===================== LOKASI =====================
exports.getAllLokasi = async (req, res) => {
    try {
        const lokasi = await prisma.lokasi.findMany({
            orderBy: { createdAt: 'desc' }
        })
        res.json({ success: true, data: lokasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.getLokasiById = async (req, res) => {
    try {
        const lokasi = await prisma.lokasi.findUnique({
            where: { id: parseInt(req.params.id) }
        })
        if (!lokasi) {
            return res.status(404).json({ success: false, message: 'Lokasi tidak ditemukan' })
        }
        res.json({ success: true, data: lokasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.createLokasi = async (req, res) => {
    try {
        const { name, latitude, longitude, radius, type } = req.body
        const lokasi = await prisma.lokasi.create({
            data: { name, latitude, longitude, radius: parseInt(radius) || 0, type: type || 'circle' }
        })
        res.status(201).json({ success: true, data: lokasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.updateLokasi = async (req, res) => {
    try {
        const { name, latitude, longitude, radius, type } = req.body
        const lokasi = await prisma.lokasi.update({
            where: { id: parseInt(req.params.id) },
            data: { name, latitude, longitude, radius: parseInt(radius) || 0, type: type || 'circle' }
        })
        res.json({ success: true, data: lokasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.deleteLokasi = async (req, res) => {
    try {
        await prisma.lokasi.delete({
            where: { id: parseInt(req.params.id) }
        })
        res.json({ success: true, message: 'Lokasi berhasil dihapus' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ===================== SHIFT CODE =====================
exports.getAllShiftCode = async (req, res) => {
    try {
        const shiftCode = await prisma.shiftCode.findMany({
            orderBy: [{ kodeShift: 'asc' }, { createdAt: 'desc' }]
        })
        res.json({ success: true, data: shiftCode })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.getShiftCodeById = async (req, res) => {
    try {
        const shiftCode = await prisma.shiftCode.findUnique({
            where: { id: parseInt(req.params.id) }
        })
        if (!shiftCode) {
            return res.status(404).json({ success: false, message: 'Shift code tidak ditemukan' })
        }
        res.json({ success: true, data: shiftCode })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.createShiftCode = async (req, res) => {
    try {
        const { namaShift, kodeShift, rentangWaktu, keterangan } = req.body
        const shiftCode = await prisma.shiftCode.create({
            data: {
                namaShift,
                kodeShift,
                rentangWaktu,
                keterangan: keterangan || null,
            }
        })
        res.status(201).json({ success: true, data: shiftCode })
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'Kode shift sudah terdaftar' })
        }
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.updateShiftCode = async (req, res) => {
    try {
        const { namaShift, kodeShift, rentangWaktu, keterangan } = req.body
        const shiftCode = await prisma.shiftCode.update({
            where: { id: parseInt(req.params.id) },
            data: {
                namaShift,
                kodeShift,
                rentangWaktu,
                keterangan: keterangan || null,
            }
        })
        res.json({ success: true, data: shiftCode })
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'Kode shift sudah terdaftar' })
        }
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.deleteShiftCode = async (req, res) => {
    try {
        await prisma.shiftCode.delete({
            where: { id: parseInt(req.params.id) }
        })
        res.json({ success: true, message: 'Shift code berhasil dihapus' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ===================== MATERIAL TYPE =====================
exports.getAllMaterialType = async (req, res) => {
    try {
        const materialType = await prisma.materialType.findMany({
            orderBy: [{ jenisMuatan: 'asc' }, { createdAt: 'desc' }]
        })
        res.json({ success: true, data: materialType })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.getMaterialTypeById = async (req, res) => {
    try {
        const materialType = await prisma.materialType.findUnique({
            where: { id: parseInt(req.params.id) }
        })
        if (!materialType) {
            return res.status(404).json({ success: false, message: 'Material type tidak ditemukan' })
        }
        res.json({ success: true, data: materialType })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.createMaterialType = async (req, res) => {
    try {
        const { jenisMuatan } = req.body
        const materialType = await prisma.materialType.create({
            data: { jenisMuatan }
        })
        res.status(201).json({ success: true, data: materialType })
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'Jenis muatan sudah terdaftar' })
        }
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.updateMaterialType = async (req, res) => {
    try {
        const { jenisMuatan } = req.body
        const materialType = await prisma.materialType.update({
            where: { id: parseInt(req.params.id) },
            data: { jenisMuatan }
        })
        res.json({ success: true, data: materialType })
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'Jenis muatan sudah terdaftar' })
        }
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.deleteMaterialType = async (req, res) => {
    try {
        await prisma.materialType.delete({
            where: { id: parseInt(req.params.id) }
        })
        res.json({ success: true, message: 'Material type berhasil dihapus' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ===================== KALIBRASI =====================
exports.getAllKalibrasi = async (req, res) => {
    try {
        const kalibrasi = await prisma.kalibrasi.findMany({
            include: { alat: true },
            orderBy: { createdAt: 'desc' }
        })
        res.json({ success: true, data: kalibrasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.getKalibrasiById = async (req, res) => {
    try {
        const kalibrasi = await prisma.kalibrasi.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { alat: true }
        })
        if (!kalibrasi) {
            return res.status(404).json({ success: false, message: 'Kalibrasi tidak ditemukan' })
        }
        res.json({ success: true, data: kalibrasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.createKalibrasi = async (req, res) => {
    try {
        const { alatId, empty, full, kapasitasTangki } = req.body
        const kalibrasi = await prisma.kalibrasi.create({
            data: {
                alatId: parseInt(alatId),
                empty: parseInt(empty) || 0,
                full: parseInt(full) || 1023,
                kapasitasTangki: parseInt(kapasitasTangki) || 0
            },
            include: { alat: true }
        })
        res.status(201).json({ success: true, data: kalibrasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.updateKalibrasi = async (req, res) => {
    try {
        const { alatId, empty, full, kapasitasTangki } = req.body
        const kalibrasi = await prisma.kalibrasi.update({
            where: { id: parseInt(req.params.id) },
            data: {
                alatId: parseInt(alatId),
                empty: parseInt(empty) || 0,
                full: parseInt(full) || 1023,
                kapasitasTangki: parseInt(kapasitasTangki) || 0
            },
            include: { alat: true }
        })
        res.json({ success: true, data: kalibrasi })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.deleteKalibrasi = async (req, res) => {
    try {
        await prisma.kalibrasi.delete({
            where: { id: parseInt(req.params.id) }
        })
        res.json({ success: true, message: 'Kalibrasi berhasil dihapus' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ===================== PENGAWAS =====================
const bcrypt = require('bcryptjs')

exports.getAllPengawas = async (req, res) => {
    try {
        const pengawas = await prisma.pengawas.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, nama: true, email: true, noTelp: true, fotoProfil: true, createdAt: true
            }
        })
        res.json({ success: true, data: pengawas })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.getPengawasById = async (req, res) => {
    try {
        const pengawas = await prisma.pengawas.findUnique({
            where: { id: parseInt(req.params.id) },
            select: {
                id: true, nama: true, email: true, noTelp: true, fotoProfil: true, createdAt: true
            }
        })
        if (!pengawas) {
            return res.status(404).json({ success: false, message: 'Pengawas tidak ditemukan' })
        }
        res.json({ success: true, data: pengawas })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.createPengawas = async (req, res) => {
    try {
        const { nama, email, password, noTelp } = req.body
        const hashedPassword = await bcrypt.hash(password, 10)
        const fotoProfil = req.file ? `/uploads/${req.file.filename}` : null

        const pengawas = await prisma.pengawas.create({
            data: { nama, email, password: hashedPassword, noTelp, fotoProfil },
            select: {
                id: true, nama: true, email: true, noTelp: true, fotoProfil: true, createdAt: true
            }
        })
        res.status(201).json({ success: true, data: pengawas })
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'Email sudah terdaftar' })
        }
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.updatePengawas = async (req, res) => {
    try {
        const { nama, email, password, noTelp } = req.body
        const updateData = { nama, email, noTelp }

        if (password) {
            updateData.password = await bcrypt.hash(password, 10)
        }
        if (req.file) {
            updateData.fotoProfil = `/uploads/${req.file.filename}`
        }

        const pengawas = await prisma.pengawas.update({
            where: { id: parseInt(req.params.id) },
            data: updateData,
            select: {
                id: true, nama: true, email: true, noTelp: true, fotoProfil: true, createdAt: true
            }
        })
        res.json({ success: true, data: pengawas })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

exports.deletePengawas = async (req, res) => {
    try {
        await prisma.pengawas.delete({
            where: { id: parseInt(req.params.id) }
        })
        res.json({ success: true, message: 'Pengawas berhasil dihapus' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}
