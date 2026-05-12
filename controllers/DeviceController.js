// express-backend/controllers/DeviceController.js
const prisma = require('../prisma/client');
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'wss://mqtt.aispektra.com:443';

// ---------- MQTT client ----------
const mqttClient = mqtt.connect(MQTT_URL, {
  protocolVersion: 4, // Force MQTT v3.1.1
  connectTimeout: 30_000,
  reconnectPeriod: 5_000,
  resubscribe: true,
  keepalive: 60,
});
mqttClient.on('connect', () => console.log('✅ DeviceController: MQTT connected'));
let lastMqttErr = 0;
mqttClient.on('error', (err) => {
  const now = Date.now();
  if (now - lastMqttErr > 30_000) {
    console.error('❌ DeviceController: MQTT error:', err?.message || err);
    lastMqttErr = now;
  }
});
function publishAsync(topic, payload, options = {}) {
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, payload, options, (err) => (err ? reject(err) : resolve()));
  });
}

// ---------- Helpers ----------
async function ensureDevice(vehicleId) {
  // cari by vehicleId (unique atau tidak)
  let device = null;
  try {
    device = await prisma.device.findUnique({ where: { vehicleId } });
  } catch (_) {
    device = await prisma.device.findFirst({ where: { vehicleId } });
  }
  if (device) return device;

  // buat minimal
  device = await prisma.device.create({ data: { vehicleId } });
  console.log(`[Prisma] Device auto-created for vehicleId='${vehicleId}' (id=${device.id})`);
  return device;
}

function numOrNull(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
}
function parseTsToDate(ts) {
  if (ts == null) return new Date();
  let t = Number(ts);
  if (!Number.isFinite(t)) return new Date();
  if (t >= 1e12) return new Date(t);       // ms
  if (t >= 1e9) return new Date(t * 1000); // s
  return new Date(); // fallback
}

/**
 * Map body JSON ke kolom yang ada di tabel device_calibrations:
 * - accel_bias.{x,y,z} -> mpu_ax/ay/az_offset
 * - gyro_bias.{x,y,z}  -> mpu_gx/gy/gz_offset
 * - mag_bias atau hard_iron -> mag_offset_{x,y,z}
 * - soft_iron -> jika array 3x3, ambil diagonal ke mag_scale_{x,y,z}
 *                jika object {x,y,z}, langsung ke mag_scale_{x,y,z}
 * - ts -> calibratedAt
 */
function extractCalibrationColumns(body) {
  const out = {};

  // Accel bias
  if (body?.accel_bias) {
    const a = body.accel_bias;
    const ax = numOrNull(a.x), ay = numOrNull(a.y), az = numOrNull(a.z);
    if (ax != null) out.mpu_ax_offset = ax;
    if (ay != null) out.mpu_ay_offset = ay;
    if (az != null) out.mpu_az_offset = az;
  }

  // Gyro bias
  if (body?.gyro_bias) {
    const g = body.gyro_bias;
    const gx = numOrNull(g.x), gy = numOrNull(g.y), gz = numOrNull(g.z);
    if (gx != null) out.mpu_gx_offset = gx;
    if (gy != null) out.mpu_gy_offset = gy;
    if (gz != null) out.mpu_gz_offset = gz;
  }

  // Magnetometer offsets: mag_bias atau hard_iron
  const mag = body?.mag_bias || body?.hard_iron;
  if (mag) {
    const mx = numOrNull(mag.x), my = numOrNull(mag.y), mz = numOrNull(mag.z);
    if (mx != null) out.mag_offset_x = mx;
    if (my != null) out.mag_offset_y = my;
    if (mz != null) out.mag_offset_z = mz;
  }

  // Magnetometer scaling: soft_iron (matrix 3x3 atau object {x,y,z})
  const si = body?.soft_iron;
  if (Array.isArray(si) && si.length === 3 && si.every(r => Array.isArray(r) && r.length === 3)) {
    const sx = numOrNull(si[0][0]);
    const sy = numOrNull(si[1][1]);
    const sz = numOrNull(si[2][2]);
    if (sx != null) out.mag_scale_x = sx;
    if (sy != null) out.mag_scale_y = sy;
    if (sz != null) out.mag_scale_z = sz;
  } else if (si && typeof si === 'object') {
    const sx = numOrNull(si.x), sy = numOrNull(si.y), sz = numOrNull(si.z);
    if (sx != null) out.mag_scale_x = sx;
    if (sy != null) out.mag_scale_y = sy;
    if (sz != null) out.mag_scale_z = sz;
  }

  // Timestamp → calibratedAt
  if (body?.ts != null) {
    out.calibratedAt = parseTsToDate(body.ts);
  } else {
    out.calibratedAt = new Date();
  }

  return out;
}

async function saveCalibration(deviceId, cols) {
  const existing = await prisma.deviceCalibration.findFirst({ where: { deviceId } });
  if (existing) {
    return prisma.deviceCalibration.update({
      where: { id: existing.id },
      data: cols,
    });
  }
  return prisma.deviceCalibration.create({
    data: { deviceId, ...cols },
  });
}

// ---------- Controllers ----------
const updateCalibration = async (req, res) => {
  const { id: vehicleId } = req.params;
  const body = req.body || {};

  if (!vehicleId) {
    return res.status(400).json({ success: false, message: 'vehicleId wajib di path parameter.' });
  }

  try {
    // 1) pastikan device ada / buat bila belum
    const device = await ensureDevice(vehicleId);

    // 2) map body → kolom yang tersedia
    const cols = extractCalibrationColumns(body);
    if (Object.keys(cols).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Payload kalibrasi tidak berisi field yang dikenali (accel_bias/gyro_bias/mag_bias/hard_iron/soft_iron/ts).'
      });
    }

    // 3) simpan
    const saved = await saveCalibration(device.id, cols);
    console.log(`[Prisma] Calibration saved for ${vehicleId} (calibId=${saved.id})`);

    // 4) kirim downlink ke perangkat (payload asli agar firmware bebas konsumsi)
    const downlinkTopic = `${vehicleId}/calibration`;
    try {
      await publishAsync(downlinkTopic, JSON.stringify({ cmd: 'apply_calibration', data: body }), { qos: 1 });
      console.log(`[MQTT] Published -> ${downlinkTopic}`);
    } catch (e) {
      console.error('[MQTT] Publish failed:', e?.message || e);
      // tidak mem-block HTTP
    }

    return res.status(200).json({
      success: true,
      message: `Kalibrasi untuk ${vehicleId} disimpan. Downlink dikirim ke MQTT.`,
      data: { vehicleId, calibrationId: saved.id },
    });
  } catch (error) {
    console.error('[DeviceController.updateCalibration] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getCalibration = async (req, res) => {
  const { id: vehicleId } = req.params;
  try {
    let device;
    try {
      device = await prisma.device.findUnique({ where: { vehicleId } });
    } catch (_) {
      device = await prisma.device.findFirst({ where: { vehicleId } });
    }
    if (!device) {
      return res.status(404).json({ success: false, message: `Device '${vehicleId}' tidak ditemukan.` });
    }
    const calib = await prisma.deviceCalibration.findFirst({ where: { deviceId: device.id } });
    if (!calib) {
      return res.status(404).json({ success: false, message: 'Data kalibrasi tidak ditemukan.' });
    }
    return res.status(200).json({ success: true, data: calib });
  } catch (error) {
    console.error('[DeviceController.getCalibration] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const sendCommand = (req, res) => {
  console.log('Request sendCommand:', req.body);
  return res.status(200).json({ success: true, message: 'Perintah diterima (placeholder).' });
};

module.exports = { updateCalibration, getCalibration, sendCommand };
