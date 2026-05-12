// express-backend/controllers/PayloadController.js
const { InfluxDB } = require('@influxdata/influxdb-client');
const mysql = require('mysql2/promise');
const { getInfluxConfig } = require('../db/influxConfig');

// --- ENV (tahan banting) ---
const {
  url: influxUrl,
  token: influxToken,
  org: influxOrg,
  bucket: influxBucket,
} = getInfluxConfig();

const mysqlHost = process.env.MYSQL_HOST || process.env.DB_HOST || 'mysql';
const mysqlDb   = process.env.MYSQL_DB   || process.env.DB_DATABASE || 'db_mysql_ais';
const mysqlUser = process.env.MYSQL_USER || process.env.DB_USER || 'root';
const mysqlPass = process.env.MYSQL_PASS || process.env.DB_PASSWORD || 'aispassword';

// offset jam lokal (+07:00 = 420 menit)
const TZ_OFFSET_MIN = parseInt(process.env.APP_TZ_OFFSET_MIN || '420', 10);

// formatter ISO dengan offset (mis. +07:00)
const pad = (n) => String(n).padStart(2, '0');
function toTZISO(date, offsetMin) {
  const ms = date.getTime() + offsetMin * 60 * 1000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  const sign = offsetMin >= 0 ? '+' : '-';
  const off = Math.abs(offsetMin);
  const oh = pad(Math.floor(off / 60));
  const om = pad(off % 60);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${oh}:${om}`;
}

// map kode status → label
const unitMap = { 0: 'MATI', 1: 'IDLE', 2: 'AKTIF' };

// init influx client
const influx = new InfluxDB({ url: influxUrl, token: influxToken });
const queryApi = influx.getQueryApi(influxOrg);

async function getOperatorProfile(operatorId) {
  if (!operatorId) return { nama: null, jabatan: null, devisi: null };
  try {
    const conn = await mysql.createConnection({
      host: mysqlHost, user: mysqlUser, password: mysqlPass, database: mysqlDb
    });
    const [rows] = await conn.execute(
      'SELECT name, role, division FROM operators WHERE operator_id = ? LIMIT 1',
      [operatorId]
    );
    await conn.end();
    if (rows && rows.length) {
      return {
        nama: rows[0].name || null,
        jabatan: rows[0].role || null,
        devisi: rows[0].division || null
      };
    }
  } catch (e) {
    console.warn('[PayloadController] MySQL lookup optional gagal:', e.message);
  }
  return { nama: null, jabatan: null, devisi: null };
}

async function latestPayload(req, res) {
  const vehicleId = req.params.vehicleId;

  try {
    // 1) Ambil last per field (numerik) + fuel_anomaly (di-cast ke float 0/1), pivot
    const fluxFields = `
      import "influxdata/influxdb/schema"

      numFields = [
        "lat","lon","spd_kph","heading_deg",
        "esp_v_batt","esp_i_sys","raspi_v_batt","raspi_i_sys","aki_v_batt","aki_i_sys",
        "fuel_vol_l","cons_l_total","unit_state_code"
      ]

      num =
        from(bucket: "${influxBucket}")
          |> range(start: -24h)
          |> filter(fn: (r) => r._measurement == "telemetry" and r.vehicle_id == "${vehicleId}")
          |> filter(fn: (r) => contains(value: r._field, set: numFields))
          |> map(fn: (r) => ({ r with _value: float(v: r._value) }))
          |> group(columns: ["_field"])
          |> last()

      anom =
        from(bucket: "${influxBucket}")
          |> range(start: -24h)
          |> filter(fn: (r) => r._measurement == "telemetry" and r.vehicle_id == "${vehicleId}")
          |> filter(fn: (r) => r._field == "fuel_anomaly")
          |> map(fn: (r) => ({
              r with
              _value: if string(v: r._value) == "true" then 1.0
                      else if string(v: r._value) == "false" then 0.0
                      else float(v: r._value)
          }))
          |> group(columns: ["_field"])
          |> last()

      union(tables: [num, anom])
        |> group()
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    // 2) Ambil TAG TERBARU (device_id, trip_id, operator_id) — tanpa "now()+30d"
    const fluxTags = `
      from(bucket: "${influxBucket}")
        |> range(start: -24h)                // cukup start saja (hindari now()+30d)
        |> filter(fn: (r) => r._measurement == "telemetry" and r.vehicle_id == "${vehicleId}")
        |> keep(columns: ["_time","vehicle_id","device_id","trip_id","operator_id"])
        |> group()
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    const [rowsFields, rowsTags] = await Promise.all([
      queryApi.collectRows(fluxFields),
      queryApi.collectRows(fluxTags),
    ]);

    if (!rowsFields || rowsFields.length === 0) {
      return res.status(404).json({ error: 'No telemetry' });
    }

    const r = rowsFields[0];
    const t = rowsTags && rowsTags[0] ? rowsTags[0] : {};

    const waktu = toTZISO(new Date(r._time || t._time || Date.now()), TZ_OFFSET_MIN);

    const deviceId   = t.device_id || r.device_id || null;
    const tripId     = t.trip_id   || r.trip_id   || null;
    const operatorId = t.operator_id || r.operator_id || null;

    const statusUnit = unitMap[Number(r.unit_state_code)] || 'MATI';
    const operatorDisplay = operatorId ? (String(operatorId).startsWith('RFID:') ? operatorId : `RFID:${operatorId}`) : null;

    const { nama, jabatan, devisi } = await getOperatorProfile(operatorId);

    const out = {
      "Waktu": waktu,
      "ID Alat": deviceId,
      "Unit Kendaraan": vehicleId,
      "Kecepatan Kendaraan (Km/h)": r.spd_kph != null ? Number(r.spd_kph) : null,
      "Jenis muatan": null,
      "Status Muatan": null,
      "Start": "-",
      "Rentang Waktu Aktif": "-",
      "Total Durasi Aktif": "-",
      "Rentang Waktu Pasif": "-",
      "Total Waktu Pasif": "-",
      "Status Unit": statusUnit,
      "Nama": nama,
      "ID": operatorDisplay,
      "Jabatan": jabatan,
      "Devisi": devisi,
      "Latitude": r.lat != null ? Number(r.lat) : null,
      "Longitude": r.lon != null ? Number(r.lon) : null,
      "Trip": tripId,
      "Volume Bahan Bakar": r.fuel_vol_l != null ? Number(r.fuel_vol_l) : null,
      "Konsumsi Bahan Bakar": r.cons_l_total != null ? Number(r.cons_l_total) : null,
      "anomali status bahan bakar": r.fuel_anomaly ? Boolean(r.fuel_anomaly) : false,
      "Bahan Bakar Masuk": null
    };

    return res.json(out);
  } catch (err) {
    console.error('[PayloadController] error:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}

module.exports = { latestPayload };
