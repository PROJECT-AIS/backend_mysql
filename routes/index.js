// express-backend/routes/index.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// ✅ FIX: path harus ../utils karena file ini ada di routes/
const { initCommandBridge } = require('../utils/commandBridge');

// Import controllers
const registerController = require('../controllers/RegisterController');
const loginController = require('../controllers/LoginController');
const userController = require('../controllers/UserController');
const configController = require('../controllers/ConfigController');
const deviceController = require('../controllers/DeviceController');
const eventController = require('../controllers/EventController');
const PayloadController = require('../controllers/PayloadController');
const InfluxController = require('../controllers/InfluxController');
const DashboardController = require('../controllers/DashboardController');

// NOTE: mqttPublish masih dipakai oleh route lain (/config, /log/send)
const { publish: mqttPublish } = require('../utils/mqttClient');

// Import config utilities
require('../utils/configBridge'); // Init config bridge
const { getConfigForVehicle } = require('../utils/configCache');

// Import validators and middleware
const { validateRegister, validateLogin } = require('../utils/validators/auth');
const verifyToken = require('../middlewares/auth');

// =======================================================
// IN-MEMORY COMMAND QUEUE (for ESP32 polling)
// =======================================================
const commandQueue = {};

// ✅ FIX: aktifkan command bridge supaya MQTT → queue jalan
initCommandBridge(commandQueue);

// =======================================================
// KONFIGURASI MULTER UNTUK UPLOAD FILE
// =======================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// =======================================================
// RUTE OTENTIKASI
// =======================================================
router.post('/register', validateRegister, registerController.register);
router.post('/login', validateLogin, loginController.login);

// =======================================================
// USER PROFILE ROUTES (Protected)
// =======================================================
router.get('/me', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);
router.post('/profile/image', verifyToken, upload.single('profileImage'), userController.uploadProfileImage);
router.delete('/profile/image', verifyToken, userController.deleteProfileImage);

// =======================================================
// PAYLOAD & TELEMETRY
// =======================================================
router.get('/payload/:vehicleId/latest', PayloadController.latestPayload);
router.get('/influx/health', verifyToken, InfluxController.health);
router.get('/influx/schema', verifyToken, InfluxController.schema);

// =======================================================
// DASHBOARD DATA (INFLUX)
// =======================================================
router.get('/dashboard/summary', verifyToken, DashboardController.getSummary);
router.get('/dashboard/vehicles', verifyToken, DashboardController.getVehicles);
router.get('/dashboard/vehicle/:vehicleId/fuel-realtime', verifyToken, DashboardController.getFuelRealtime);
router.get('/dashboard/vehicle/:vehicleId/fuel-weekly', verifyToken, DashboardController.getFuelWeekly);
router.get('/dashboard/history', verifyToken, DashboardController.getHistory);
router.get('/dashboard/statistics', verifyToken, DashboardController.getStatistics);

// =======================================================
// RUTE DEVICES
// =======================================================
router.get('/devices/:id/calibration', deviceController.getCalibration);
router.post('/devices/:id/calibration', deviceController.updateCalibration);
router.post('/devices/:id/command', deviceController.sendCommand);

// =======================================================
// CONFIG MANAGEMENT ROUTES (Protected)
// =======================================================

// Alat
router.get('/alat', verifyToken, configController.getAllAlat);
router.get('/alat/:id', verifyToken, configController.getAlatById);
router.post('/alat', verifyToken, upload.single('gambar'), configController.createAlat);
router.put('/alat/:id', verifyToken, upload.single('gambar'), configController.updateAlat);
router.delete('/alat/:id', verifyToken, configController.deleteAlat);

// Operator
router.get('/operator', verifyToken, configController.getAllOperator);
router.get('/operator/:id', verifyToken, configController.getOperatorById);
router.post('/operator', verifyToken, configController.createOperator);
router.put('/operator/:id', verifyToken, configController.updateOperator);
router.delete('/operator/:id', verifyToken, configController.deleteOperator);

// Lokasi (with public ESP endpoints below)
router.get('/lokasi', verifyToken, configController.getAllLokasi);
router.get('/lokasi/:id', verifyToken, configController.getLokasiById);
router.post('/lokasi', verifyToken, configController.createLokasi);
router.put('/lokasi/:id', verifyToken, configController.updateLokasi);
router.delete('/lokasi/:id', verifyToken, configController.deleteLokasi);

// Shift Code
router.get('/shift-code', verifyToken, configController.getAllShiftCode);
router.get('/shift-code/:id', verifyToken, configController.getShiftCodeById);
router.post('/shift-code', verifyToken, configController.createShiftCode);
router.put('/shift-code/:id', verifyToken, configController.updateShiftCode);
router.delete('/shift-code/:id', verifyToken, configController.deleteShiftCode);

// Material Type
router.get('/material-type', verifyToken, configController.getAllMaterialType);
router.get('/material-type/:id', verifyToken, configController.getMaterialTypeById);
router.post('/material-type', verifyToken, configController.createMaterialType);
router.put('/material-type/:id', verifyToken, configController.updateMaterialType);
router.delete('/material-type/:id', verifyToken, configController.deleteMaterialType);

// Kalibrasi
router.get('/kalibrasi', verifyToken, configController.getAllKalibrasi);
router.get('/kalibrasi/:id', verifyToken, configController.getKalibrasiById);
router.post('/kalibrasi', verifyToken, configController.createKalibrasi);
router.put('/kalibrasi/:id', verifyToken, configController.updateKalibrasi);
router.delete('/kalibrasi/:id', verifyToken, configController.deleteKalibrasi);

// Pengawas (User Management)
router.get('/pengawas', verifyToken, configController.getAllPengawas);
router.get('/pengawas/:id', verifyToken, configController.getPengawasById);
router.post('/pengawas', verifyToken, upload.single('fotoProfil'), configController.createPengawas);
router.put('/pengawas/:id', verifyToken, upload.single('fotoProfil'), configController.updatePengawas);
router.delete('/pengawas/:id', verifyToken, configController.deletePengawas);

// ESP Public Endpoints (no auth required)
router.get('/esp/lokasi', configController.getAllLokasi);
router.get('/esp/lokasi/:id', configController.getLokasiById);
router.post('/esp/lokasi', configController.createLokasi);
router.put('/esp/lokasi/:id', configController.updateLokasi);
router.delete('/esp/lokasi/:id', configController.deleteLokasi);

//Versi Publik nya Material Type
// Material Type
router.get('/esp/material-type', configController.getAllMaterialType);
router.get('/esp/material-type/:id', configController.getMaterialTypeById);
router.post('/esp/material-type', configController.createMaterialType);
router.put('/esp/material-type/:id', configController.updateMaterialType);
router.delete('/esp/material-type/:id', configController.deleteMaterialType);

// =======================================================
// RUTE EVENT & UPLOAD
// =======================================================
router.post('/upload-image', upload.single('image'), eventController.handleImageUpload);

// =======================================================
// TELEMETRY INGEST - DISABLED (previously published to MQTT lora/* and fms/*)
// =======================================================
router.post('/ingest', async (req, res) => {
  return res.status(410).json({
    ok: false,
    error: 'INGEST DISABLED'
  });
});

// =======================================================
// RUTE UPLINK: from website -> MQTT: fms/{vehicle_id}/config/set
// =======================================================
router.post('/config', async (req, res) => {
  try {
    const body = req.body || {};
    const { vehicle_id, device_id, version, timestamp_ms, ...rest } = body;

    if (!vehicle_id) {
      return res.status(400).json({ ok: false, error: 'vehicle_id required' });
    }

    const configUpdate = { ...rest };
    if (device_id) configUpdate.device_id = device_id;

    if (version !== undefined || timestamp_ms !== undefined) {
      console.log('[CONFIG] ⚠️  Ignored server-managed fields from client request');
    }

    if (Object.keys(configUpdate).length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid config fields to update' });
    }

    const topic = `fms/${vehicle_id}/config/set`;
    const payload = JSON.stringify(configUpdate);
    await mqttPublish(topic, payload, { qos: 1, retain: false });

    console.log(`[CONFIG] Published to ${topic} (will be merged by configBridge)`);
    return res.json({ ok: true, topic, payload: configUpdate });
  } catch (e) {
    console.error('[CONFIG] publish failed:', e);
    return res.status(500).json({ ok: false, error: 'publish failed' });
  }
});

// =======================================================
// RUTE LOG/SEND (RPC/Command): website -> MQTT + Command Queue
// =======================================================
router.post('/log/send', async (req, res) => {
  try {
    const body = req.body || {};
    const { vehicle_id, command, params } = body;

    if (!vehicle_id) {
      return res.status(400).json({ ok: false, error: 'vehicle_id required' });
    }
    if (!command) {
      return res.status(400).json({ ok: false, error: 'command required' });
    }

    const topic = `fms/${vehicle_id}/log/send`;
    const payloadObj = {
      type: 'command',
      cmd: command,
      timestamp: Date.now(),
      ...(params && typeof params === 'object' ? params : {}),
    };

    const payload = JSON.stringify(payloadObj);
    await mqttPublish(topic, payload, { qos: 1, retain: false });

    if (!commandQueue[vehicle_id]) commandQueue[vehicle_id] = [];
    commandQueue[vehicle_id].push(payloadObj);

    console.log(`[LOG/SEND] Published to ${topic} cmd=${command}`);
    console.log(`[LOG/SEND] Added to queue for ${vehicle_id} (queue size: ${commandQueue[vehicle_id].length})`);

    return res.json({ ok: true, topic, payload: payloadObj });
  } catch (e) {
    console.error('[LOG/SEND] publish failed:', e);
    return res.status(500).json({ ok: false, error: 'publish failed' });
  }
});

// =======================================================
// GET LATEST CONFIG: ESP32 polling
// =======================================================
router.get('/devices/:vehicleId/config', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const config = getConfigForVehicle(vehicleId);

    if (config) {
      return res.json({ ok: true, config });
    }

    return res.json({
      ok: true,
      config: {
        vehicle_id: vehicleId,
        device_id: 'FMS-VCU-001',
        version: 0,
        fuel: { tank_capacity: 6500000 },
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// =======================================================
// GET COMMANDS: ESP32 polling
// =======================================================
router.get('/devices/:vehicleId/commands', (req, res) => {
  try {
    const { vehicleId } = req.params;
    const commands = commandQueue[vehicleId] || [];
    commandQueue[vehicleId] = [];

    console.log(`[COMMANDS] ESP32 ${vehicleId} polled, delivering ${commands.length} command(s)`);

    return res.json({ ok: true, commands, count: commands.length });
  } catch (e) {
    console.error('[COMMANDS] Error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Export router AND commandQueue
module.exports = router;
module.exports.commandQueue = commandQueue;
