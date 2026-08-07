const { InfluxDB } = require('@influxdata/influxdb-client');
const { getInfluxConfig } = require('../db/influxConfig');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let cachedQueryApi = null;
let cachedQueryKey = '';

const getInfluxQueryContext = () => {
  const config = getInfluxConfig();
  const queryKey = `${config.url}|${config.token}|${config.org}|${config.bucket}`;

  if (!cachedQueryApi || cachedQueryKey !== queryKey) {
    cachedQueryApi = new InfluxDB({ url: config.url, token: config.token }).getQueryApi(config.org);
    cachedQueryKey = queryKey;
  }

  return { config, queryApi: cachedQueryApi };
};

const TZ_OFFSET_MIN = parseInt(process.env.APP_TZ_OFFSET_MIN || '480', 10);

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

const getSummary = async (req, res) => {
  const { config, queryApi } = getInfluxQueryContext();

  try {
    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: -24h)
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) => r._field == "unit_state_code" or r._field == "cons_l_total")
        |> group(columns: ["vehicle_id", "_field"])
        |> last()
    `;

    const rows = await queryApi.collectRows(flux);
    
    // Merge fields manually per vehicle because pivot fails on mismatched timestamps
    const vehicleMap = {};
    rows.forEach(row => {
      const vid = row.vehicle_id;
      if (!vehicleMap[vid]) {
        vehicleMap[vid] = { vehicle_id: vid, _time: row._time };
      }
      vehicleMap[vid][row._field] = row._value;
      if (new Date(row._time) > new Date(vehicleMap[vid]._time)) {
        vehicleMap[vid]._time = row._time;
      }
    });

    let totalDevices = 0;
    let onDevices = 0;
    let offDevices = 0;
    let totalConsumsiBbm = 0;

    const now = Date.now();
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes tolerance for stability

    Object.values(vehicleMap).forEach(row => {
      totalDevices++;
      const state = Number(row.unit_state_code || 0);
      const lastUpdateTime = row._time ? new Date(row._time).getTime() : 0;
      const isStale = (now - lastUpdateTime) > TIMEOUT_MS;
      
      const isOnline = state > 0 && !isStale;
      if (isOnline) {
        onDevices++;
        totalConsumsiBbm += Number(row.cons_l_total || 0);
      } else {
        offDevices++;
      }
    });

    // Real production data from Prisma
    const dataTrips = await prisma.dataTrip.findMany();
    
    // STRICTLY use only standard labels
    const categories = [
      'OB - Disposal',
      'LIM ORE - Stockpile',
      'LIM ORE - Barge',
      'SAP ORE - Stockpile',
      'SAP ORE - Barge'
    ];

    const produksiMap = {};
    categories.forEach(label => {
      produksiMap[label] = 0;
    });

    dataTrips.forEach(trip => {
      const type = ((trip.jenisMuatan || '') + ' ' + (trip.lokasiStart || '')).toUpperCase();
      const finish = (trip.lokasiFinish || '').toUpperCase();
      
      if (type.includes('OB')) {
        produksiMap['OB - Disposal']++;
      } else if (type.includes('LIM')) {
        if (finish.includes('BARGE') || type.includes('BARGE')) produksiMap['LIM ORE - Barge']++;
        else produksiMap['LIM ORE - Stockpile']++;
      } else if (type.includes('SAP')) {
        if (finish.includes('BARGE') || type.includes('BARGE')) produksiMap['SAP ORE - Barge']++;
        else produksiMap['SAP ORE - Stockpile']++;
      }
    });

    const produksi_items = categories.map(label => ({
      label,
      value: produksiMap[label]
    }));

    res.json({
      status_device: {
        total: totalDevices,
        on: onDevices,
        lossCoordinate: 0,
        off: offDevices
      },
      status_alat: {
        total: totalDevices,
        on: onDevices,
        passive: 0,
        off: offDevices
      },
      total_produksi: dataTrips.length,
      produksi_items: produksi_items,
      konsumsi_bbm: totalConsumsiBbm
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getVehicles = async (req, res) => {
  const { config, queryApi } = getInfluxQueryContext();

  try {
    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: -15m)
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> group(columns: ["vehicle_id", "_field"])
        |> last()
        |> map(fn: (r) => ({ r with _value: string(v: r._value) }))
        |> pivot(rowKey:["vehicle_id"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["vehicle_id", "device_id", "lat", "lon", "spd_kph", "heading_deg", "fuel_vol_l", "cons_l_total", "unit_state_code", "operator_id", "operator_name", "lokasi_awal", "lokasi_akhir", "geofence", "_time"])
    `;

    const rows = await queryApi.collectRows(flux);
    
    const now = Date.now();
    const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

    const vehicles = rows.map(r => {
      const lastUpdateTime = r._time ? new Date(r._time).getTime() : 0;
      const isStale = (now - lastUpdateTime) > TIMEOUT_MS;
      
      return {
        id: r.vehicle_id,
        idFms: r.device_id,
        lat: Number(r.lat),
        lng: Number(r.lon),
        speed: Number(r.spd_kph),
        heading: Number(r.heading_deg),
        fuelLevel: Number(r.fuel_vol_l),
        fuelConsumption: Number(r.cons_l_total),
        // Status is online ONLY if it was recently updated AND has unit_state_code > 0
        status: (Number(r.unit_state_code) > 0 && !isStale) ? 'online' : 'offline',
        time: r._time ? toTZISO(new Date(r._time), TZ_OFFSET_MIN) : "-",
        name: r.vehicle_id,
        plateNumber: r.vehicle_id,
        lokasiAwal: r.lokasi_awal || "-",
        lokasiAkhir: r.lokasi_akhir || "-",
        geofenceName: r.geofence || "-",
        operatorId: r.operator_id || "-",
        operatorName: r.operator_name || "-"
      };
    });

    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getFuelRealtime = async (req, res) => {
  const { vehicleId } = req.params;
  const { config, queryApi } = getInfluxQueryContext();

  try {
    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: -6h) 
        |> filter(fn: (r) => r.vehicle_id == "${vehicleId}" and r._field == "fuel_vol_l")
        |> aggregateWindow(every: 5m, fn: last, createEmpty: true)
        |> fill(usePrevious: true)
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 10)
    `;

    const rows = await queryApi.collectRows(flux);
    // Reverse so chart goes left (oldest) to right (newest)
    const data = rows.reverse().map(r => ({
      time: toTZISO(new Date(r._time), TZ_OFFSET_MIN).split('T')[1].substring(0, 5),
      value: Number(Number(r._value).toFixed(2))
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getFuelWeekly = async (req, res) => {
  const { vehicleId } = req.params;
  const { config, queryApi } = getInfluxQueryContext();

  try {
    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: -24h)
        |> filter(fn: (r) => r.vehicle_id == "${vehicleId}" and r._field == "cons_l_total")
        |> aggregateWindow(every: 2h, fn: spread, createEmpty: true)
        |> fill(value: 0.0)
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 12)
    `;

    const rows = await queryApi.collectRows(flux);
    const data = rows.reverse().map(r => ({
      time: toTZISO(new Date(r._time), TZ_OFFSET_MIN).split('T')[1].substring(0, 5),
      value: Number(Number(r._value).toFixed(2))
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getHistory = async (req, res) => {
  const { vehicle_id, page = 1, limit = 50, from, to } = req.query;
  const start = from ? from : '-7d';
  const stop = to ? to : 'now()';

  const { config, queryApi } = getInfluxQueryContext();
  if (!config.token || !config.org || !config.bucket) {
    console.error("InfluxDB Configuration Missing:", config);
    return res.status(500).json({ error: 'InfluxDB Configuration (Token/Org/Bucket) is missing on server' });
  }

  try {
    let filterVehicle = '';
    if (vehicle_id && vehicle_id !== '') {
      filterVehicle = `|> filter(fn: (r) => r.vehicle_id == "${vehicle_id}")`;
    }

    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) =>
          r._field == "lat" or r._field == "lon"
          or r._field == "spd_kph" or r._field == "unit_state_code"
          or r._field == "fuel_vol_l" or r._field == "cons_l_total"
          or r._field == "trip_id" or r._field == "status_trip"
          or r._field == "lokasi_awal" or r._field == "lokasi_akhir"
          or r._field == "jenis_muatan" or r._field == "payload_type"
          or r._field == "operator_id" or r._field == "operator_name"
        )
        ${filterVehicle}
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${limit * 10}) 
        |> map(fn: (r) => ({ r with _value: string(v: r._value) }))
        |> pivot(rowKey:["_time", "device_id"], columnKey: ["_field"], valueColumn: "_value")
        |> limit(n: ${limit})
    `;

    const rows = await queryApi.collectRows(flux);
    const total = rows.length; // Temporary total

    const formatted = rows.map((r, i) => ({
      seq: (page - 1) * limit + i + 1,
      waktu: r._time ? toTZISO(new Date(r._time), TZ_OFFSET_MIN).replace('T', ' ').split('.')[0] : "-",
      idAlat: r.device_id || "-",
      unitKendaraan: r.vehicle_id || "-",
      kecepatanKendaraan: Number(r.spd_kph || 0),
      jenisMuatan: r.jenis_muatan || r.payload_type || "-",
      statusTrip: r.status_trip || (r.trip_id ? "ON TRIP" : "END TRIP"),
      statusMuatan: r.payload_status || "-",
      statusUnit: {
        start: r.start_time || "-",
        rentangWaktuAktif: r.active_range || "-",
        totalDurasiAktif: r.active_duration || "-",
        rentangWaktuPasif: r.passive_range || "-",
        totalWaktuPasif: r.passive_duration || "-",
        mati: Number(r.unit_state_code) === 0 ? "Ya" : "Tidak"
      },
      operator: {
        nama: r.operator_name || "-",
        id: r.operator_id || "-",
        jabatan: r.operator_role || "-",
        divisi: r.operator_division || "-"
      },
      gps: {
        latitude: Number(r.lat || 0),
        longitude: Number(r.lon || 0),
        trip: r.trip_id || "-"
      },
      sensorFuel: {
        volumeBahanBakar: Number(r.fuel_vol_l || 0),
        konsumsi: Number(r.cons_l_total || 0),
        anomaliStatus: String(r.fuel_anomaly) === "true" ? "Terdeteksi" : "Normal",
        bahanBakarMasuk: Number(r.fuel_in || 0)
      },
      lokasi: {
        awal: r.lokasi_awal || r.loc_start || "-",
        akhir: r.lokasi_akhir || r.loc_end || "-"
      },
      retase: {
        setUlangRetase: r.retase_reset || "-"
      }
    }));

    return res.status(200).json({
      data: formatted,
      total: total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    console.error("History Error:", err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};

const getStatistics = async (req, res) => {
  const { period = 'realtime' } = req.query;
  const { config, queryApi } = getInfluxQueryContext();
  let range = '-6h';
  let window = '1h';

  if (period === 'today') {
    range = '-24h';
    window = '12h';
  } else if (period === 'week') {
    range = '-7d';
    window = '1d';
  }

  const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const toLocalDate = (date) => new Date(date.getTime() + TZ_OFFSET_MIN * 60 * 1000);
  const getLabelByPeriod = (date) => {
    const local = toLocalDate(date);
    if (period === 'week') {
      return dayLabels[local.getUTCDay()];
    }
    if (period === 'today') {
      return local.getUTCHours() < 12 ? 'Shift 1' : 'Shift 2';
    }
    return `${pad(local.getUTCHours())}:00`;
  };

  try {
    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: ${range})
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) => r._field == "cons_l_total" or r._field == "unit_state_code")
        |> group(columns: ["vehicle_id", "_field"])
        |> aggregateWindow(every: ${window}, fn: last, createEmpty: true)
        |> fill(usePrevious: true)
        |> group(columns: ["_time", "vehicle_id"])
        |> pivot(rowKey:["_time", "vehicle_id"], columnKey: ["_field"], valueColumn: "_value")
    `;

    const rows = await queryApi.collectRows(flux);
    const bucketMap = new Map();

    rows.forEach((r) => {
      const timeValue = r._time ? new Date(r._time) : null;
      if (!timeValue || Number.isNaN(timeValue.getTime())) return;

      const key = timeValue.toISOString();
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          time: key,
          label: getLabelByPeriod(timeValue),
          fuel: 0,
          operating: 0,
        });
      }

      const bucket = bucketMap.get(key);
      const state = Number(r.unit_state_code || 0);
      const fuel = Number(r.cons_l_total || 0);

      if (state > 0) {
        bucket.operating += 1;
        bucket.fuel += fuel;
      }
    });

    const data = Array.from(bucketMap.values()).sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getSummary,
  getVehicles,
  getFuelRealtime,
  getFuelWeekly,
  getHistory,
  getStatistics
};
