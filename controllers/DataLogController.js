const { InfluxDB } = require('@influxdata/influxdb-client');
const { getInfluxConfig } = require('../db/influxConfig');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────
const escapeFlux = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const TZ_OFFSET_MIN = parseInt(process.env.APP_TZ_OFFSET_MIN || '480', 10);
const pad = (n) => String(n).padStart(2, '0');

function toLocalISO(date) {
  const ms = date.getTime() + TZ_OFFSET_MIN * 60 * 1000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  const sign = TZ_OFFSET_MIN >= 0 ? '+' : '-';
  const off = Math.abs(TZ_OFFSET_MIN);
  const oh = pad(Math.floor(off / 60));
  const om = pad(off % 60);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${oh}:${om}`;
}

const unitStateLabel = { 0: 'MATI', 1: 'IDLE', 2: 'AKTIF' };

// cached InfluxDB query API
let _qApi = null;
let _qKey = '';
function getQueryApi() {
  const cfg = getInfluxConfig();
  const key = `${cfg.url}|${cfg.token}|${cfg.org}`;
  if (!_qApi || _qKey !== key) {
    _qApi = new InfluxDB({ url: cfg.url, token: cfg.token }).getQueryApi(cfg.org);
    _qKey = key;
  }
  return { queryApi: _qApi, bucket: cfg.bucket };
}

// lookup operator name from MySQL (Prisma) by NFC ID
async function lookupOperator(operatorId) {
  if (!operatorId) return { nama: '-', id: '-' };
  try {
    // Try OperatorNfc table first (id_card_nfc)
    const op = await prisma.operatorNfc.findFirst({
      where: { idCardNfc: operatorId },
    });
    if (op) return { nama: op.nama, id: operatorId };

    // Fallback to OperatorRfid table
    const opRfid = await prisma.operatorRfid.findFirst({
      where: { rfidVid: operatorId },
    });
    if (opRfid) return { nama: opRfid.name, id: operatorId };
  } catch (e) {
    console.warn('[DataLog] Operator lookup failed:', e.message);
  }
  return { nama: '-', id: operatorId };
}

// lookup alat info from MySQL
async function lookupAlat(vehicleId) {
  if (!vehicleId) return { idFms: '-', noPlat: '-', jenisAlat: '-', merekAlat: '-' };
  try {
    const alat = await prisma.alat.findFirst({
      where: { idFms: vehicleId },
    });
    if (alat) {
      return {
        idFms: alat.idFms,
        noPlat: alat.noUnit || alat.noPlat || '-',
        jenisAlat: alat.jenisAlat || '-',
        merekAlat: alat.merk || '-',
      };
    }
  } catch (e) {
    console.warn('[DataLog] Alat lookup failed:', e.message);
  }
  return { idFms: vehicleId, noPlat: '-', jenisAlat: '-', merekAlat: '-' };
}

// ── GET ALL: satu baris per vehicle (data terakhir) ──────
const getAll = async (req, res) => {
  const { queryApi, bucket } = getQueryApi();

  try {
    // Query: ambil data terakhir per vehicle_id, pivot semua field
      const flux = `
      from(bucket: "${escapeFlux(bucket)}")
        |> range(start: -7d)
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) =>
             r._field == "lat" or r._field == "lon"
             or r._field == "spd_kph" or r._field == "heading_deg"
             or r._field == "fuel_vol_l" or r._field == "cons_l_total"
             or r._field == "fuel_anomaly" or r._field == "fuel_in"
             or r._field == "unit_state_code" or r._field == "trip_id"
             or r._field == "status_trip" or r._field == "jenis_muatan"
             or r._field == "operator_id" or r._field == "operator_name"
        )
        |> group(columns: ["vehicle_id", "_field"])
        |> last()
        |> map(fn: (r) => ({ r with _value: string(v: r._value) }))
        |> group(columns: ["vehicle_id"])
        |> pivot(rowKey: ["vehicle_id"], columnKey: ["_field"], valueColumn: "_value")
        |> group()
        |> sort(columns: ["_time"], desc: true)
    `;

    const rows = await queryApi.collectRows(flux);

    // Enrich each row with MySQL data (operator + alat)
    const realtimeRows = await Promise.all(
      rows.map(async (r) => {
        const vehicleId = r.vehicle_id || '-';
        const operatorId = r.operator_id || null;
        const tripId = r.trip_id || null;

        const [operator, alat] = await Promise.all([
          lookupOperator(operatorId),
          lookupAlat(vehicleId),
        ]);

        const stateCode = Number(r.unit_state_code || 0);
        const waktu = r._time ? toLocalISO(new Date(r._time)) : '-';

        return {
          id: vehicleId,
          waktu,
          idAlat: alat.idFms,
          noPol: alat.noPlat,
          jenisAlat: alat.jenisAlat,
          merekAlat: alat.merekAlat,
          trip: tripId || '-',
          latitude: r.lat != null ? Number(r.lat).toFixed(6) : '-',
          longitude: r.lon != null ? Number(r.lon).toFixed(6) : '-',
          kecepatan: r.spd_kph != null ? Number(Number(r.spd_kph).toFixed(1)) : 0,
          jenisMuatan: r.jenis_muatan || r.payload_type || '-',
          volumeFuel: r.fuel_vol_l != null ? Number(Number(r.fuel_vol_l).toFixed(2)) : 0,
          konsumsiFuel: r.cons_l_total != null ? Number(Number(r.cons_l_total).toFixed(2)) : 0,
          anomaliStatusFuel: r.fuel_anomaly
            ? (String(r.fuel_anomaly) === 'true' || Number(r.fuel_anomaly) === 1 ? 'ANOMALI' : 'NORMAL')
            : 'NORMAL',
          fuelMasuk: r.fuel_in != null ? Number(Number(r.fuel_in).toFixed(2)) : 0,
          statusAlat: unitStateLabel[stateCode] || 'MATI',
          start: '-',
          rentangWaktuAktif: '-',
          durasiAktif: '-',
          rentangWaktuPassif: '-',
          durasiPassif: '-',
          mati: stateCode === 0 ? 'YA' : '-',
          namaOperator: r.operator_name || operator.nama,
          idOperator: operator.id,
          statusTrip: r.status_trip || (tripId ? 'ON TRIP' : 'END TRIP'),
        };
      })
    );

    const mysqlRows = await prisma.dataLog.findMany({
      orderBy: { waktu: 'desc' },
      take: 200,
    });

    const historicalRows = mysqlRows.map((row) => ({
      id: row.id,
      waktu: row.waktu ? toLocalISO(new Date(row.waktu)) : '-',
      idAlat: row.idAlat || '-',
      noPol: row.noPol || '-',
      jenisAlat: row.jenisAlat || '-',
      merekAlat: row.merekAlat || '-',
      trip: row.trip || '-',
      latitude: row.latitude || '-',
      longitude: row.longitude || '-',
      kecepatan: row.kecepatan ?? 0,
      jenisMuatan: row.jenisMuatan || '-',
      volumeFuel: row.volumeFuel ?? 0,
      konsumsiFuel: row.konsumsiFuel ?? 0,
      anomaliStatusFuel: row.anomaliStatusFuel || 'NORMAL',
      fuelMasuk: row.fuelMasuk ?? 0,
      statusAlat: row.statusAlat || 'MATI',
      start: row.start || '-',
      rentangWaktuAktif: row.rentangWaktuAktif || '-',
      durasiAktif: row.durasiAktif || '-',
      rentangWaktuPassif: row.rentangWaktuPassif || '-',
      durasiPassif: row.durasiPassif || '-',
      mati: row.mati || '-',
      namaOperator: row.namaOperator || '-',
      idOperator: row.idOperator || '-',
      statusTrip: row.statusTrip || '-',
    }));

    const mergeKey = (item) => `${item.idAlat || '-'}|${item.trip || '-'}|${item.waktu || '-'}|${item.statusTrip || '-'}`;
    const mergedMap = new Map();
    [...historicalRows, ...realtimeRows].forEach((item) => {
      mergedMap.set(mergeKey(item), item);
    });

    const data = Array.from(mergedMap.values()).sort((a, b) => {
      const ta = Date.parse(a.waktu);
      const tb = Date.parse(b.waktu);
      const va = Number.isNaN(ta) ? 0 : ta;
      const vb = Number.isNaN(tb) ? 0 : tb;
      return vb - va;
    });

    res.json({ ok: true, data, source: 'influxdb+mysql' });
  } catch (e) {
    console.error('[DataLog] InfluxDB query error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ── GET BY VEHICLE ID ────────────────────────────────────
const getById = async (req, res) => {
  const { id } = req.params; // vehicle_id
  const { queryApi, bucket } = getQueryApi();

  try {
      const flux = `
      from(bucket: "${escapeFlux(bucket)}")
        |> range(start: -7d)
        |> filter(fn: (r) => r._measurement == "telemetry" and r.vehicle_id == "${escapeFlux(id)}")
        |> filter(fn: (r) =>
             r._field == "lat" or r._field == "lon"
             or r._field == "spd_kph" or r._field == "heading_deg"
             or r._field == "fuel_vol_l" or r._field == "cons_l_total"
             or r._field == "fuel_anomaly" or r._field == "fuel_in"
             or r._field == "unit_state_code" or r._field == "trip_id"
             or r._field == "status_trip" or r._field == "jenis_muatan"
             or r._field == "operator_id" or r._field == "operator_name"
        )
        |> group(columns: ["_field"])
        |> last()
        |> map(fn: (r) => ({ r with _value: string(v: r._value) }))
        |> group()
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    const rows = await queryApi.collectRows(flux);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Data log tidak ditemukan untuk vehicle ini' });
    }

    const r = rows[0];
    const operatorId = r.operator_id || null;
    const tripId = r.trip_id || null;

    const [operator, alat] = await Promise.all([
      lookupOperator(operatorId),
      lookupAlat(id),
    ]);

    const stateCode = Number(r.unit_state_code || 0);

    const data = {
      id,
      waktu: r._time ? toLocalISO(new Date(r._time)) : '-',
      idAlat: alat.idFms,
      noPol: alat.noPlat,
      jenisAlat: alat.jenisAlat,
      merekAlat: alat.merekAlat,
      trip: tripId || '-',
      latitude: r.lat != null ? Number(r.lat).toFixed(6) : '-',
      longitude: r.lon != null ? Number(r.lon).toFixed(6) : '-',
      kecepatan: r.spd_kph != null ? Number(Number(r.spd_kph).toFixed(1)) : 0,
      jenisMuatan: r.jenis_muatan || r.payload_type || '-',
      volumeFuel: r.fuel_vol_l != null ? Number(Number(r.fuel_vol_l).toFixed(2)) : 0,
      konsumsiFuel: r.cons_l_total != null ? Number(Number(r.cons_l_total).toFixed(2)) : 0,
      anomaliStatusFuel: r.fuel_anomaly
        ? (String(r.fuel_anomaly) === 'true' || Number(r.fuel_anomaly) === 1 ? 'ANOMALI' : 'NORMAL')
        : 'NORMAL',
      fuelMasuk: r.fuel_in != null ? Number(Number(r.fuel_in).toFixed(2)) : 0,
      statusAlat: unitStateLabel[stateCode] || 'MATI',
      start: '-',
      rentangWaktuAktif: '-',
      durasiAktif: '-',
      rentangWaktuPassif: '-',
      durasiPassif: '-',
      mati: stateCode === 0 ? 'YA' : '-',
      namaOperator: r.operator_name || operator.nama,
      idOperator: operator.id,
      statusTrip: r.status_trip || (tripId ? 'ON TRIP' : 'END TRIP'),
    };

    res.json({ ok: true, data });
  } catch (e) {
    console.error('[DataLog] getById error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ── CREATE (kept for ESP backward compat, writes to MySQL) ──
const create = async (req, res) => {
  try {
    const payload = req.body;

    if (payload.kecepatan) payload.kecepatan = parseFloat(payload.kecepatan);
    if (payload.volumeFuel) payload.volumeFuel = parseFloat(payload.volumeFuel);
    if (payload.konsumsiFuel) payload.konsumsiFuel = parseFloat(payload.konsumsiFuel);
    if (payload.fuelMasuk) payload.fuelMasuk = parseFloat(payload.fuelMasuk);
    if (!payload.waktu) payload.waktu = new Date();

    const newData = await prisma.dataLog.create({
      data: payload,
    });
    res.status(201).json({ ok: true, data: newData });
  } catch (e) {
    console.error('[DataLog] Error creating data:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

module.exports = {
  getAll,
  create,
  getById,
};
