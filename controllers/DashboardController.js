const { InfluxDB } = require('@influxdata/influxdb-client');
const { getInfluxConfig } = require('../db/influxConfig');

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
        |> range(start: -7d)
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) => r._field == "unit_state_code" or r._field == "cons_l_total")
        |> group(columns: ["vehicle_id", "_field"])
        |> last()
        |> group(columns: ["_field"])
    `;

    const rows = await queryApi.collectRows(flux);
    
    let totalDevices = 0;
    let onDevices = 0;
    let offDevices = 0;
    let totalConsumsiBbm = 0;
    const vehicleStates = {};

    rows.forEach(row => {
      if (row._field === 'unit_state_code') {
        totalDevices++;
        const state = Number(row._value);
        if (state > 0) onDevices++; else offDevices++;
      } else if (row._field === 'cons_l_total') {
        totalConsumsiBbm += Number(row._value || 0);
      }
    });

    // Mock production data for now as it depends on complex trip logic
    const totalProduksi = 1000; 

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
      total_produksi: totalProduksi,
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
        |> range(start: -24h)
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> group(columns: ["vehicle_id", "_field"])
        |> last()
        |> pivot(rowKey:["vehicle_id"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["vehicle_id", "device_id", "lat", "lon", "spd_kph", "heading_deg", "fuel_vol_l", "unit_state_code", "_time"])
    `;

    const rows = await queryApi.collectRows(flux);
    
    const vehicles = rows.map(r => ({
      id: r.vehicle_id,
      idFms: r.device_id,
      lat: Number(r.lat),
      lng: Number(r.lon),
      speed: Number(r.spd_kph),
      heading: Number(r.heading_deg),
      fuelLevel: Number(r.fuel_vol_l),
      status: Number(r.unit_state_code) > 0 ? 'online' : 'offline',
      time: toTZISO(new Date(r._time), TZ_OFFSET_MIN),
      name: r.vehicle_id,
      plateNumber: r.vehicle_id
    }));

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
        |> range(start: -7d)
        |> filter(fn: (r) => r.vehicle_id == "${vehicleId}" and r._field == "fuel_vol_l")
        |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `;

    const rows = await queryApi.collectRows(flux);
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const data = rows.map(r => {
      const d = new Date(r._time);
      return {
        day: days[d.getUTCDay()],
        value: Number(Number(r._value).toFixed(2))
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getHistory = async (req, res) => {
  const { vehicle_id, page = 1, limit = 50, from, to } = req.query;
  const start = from ? from : '-365d';
  const stop = to ? to : 'now()';

  const { config, queryApi } = getInfluxQueryContext();
  if (!config.token || !config.org) {
    return res.status(500).json({ error: 'InfluxDB Org/Token not configured' });
  }

  try {
    let filterVehicle = '';
    if (vehicle_id && vehicle_id !== '') {
      filterVehicle = `|> filter(fn: (r) => r.vehicle_id == "${vehicle_id}")`;
    }

    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) => r._field == "lat" or r._field == "lon" or r._field == "spd_kph" or r._field == "unit_state_code" or r._field == "fuel_vol_l" or r._field == "cons_l_total")
        ${filterVehicle}
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${limit * 10}) 
        |> pivot(rowKey:["_time", "device_id"], columnKey: ["_field"], valueColumn: "_value")
        |> limit(n: ${limit})
    `;

    const rows = await queryApi.collectRows(flux);
    const total = rows.length; // Temporary total

    const formatted = rows.map((r, i) => ({
      seq: (page - 1) * limit + i + 1,
      waktu: toTZISO(new Date(r._time), TZ_OFFSET_MIN).replace('T', ' ').split('.')[0],
      idAlat: r.device_id || "-",
      unitKendaraan: r.vehicle_id || "-",
      kecepatanKendaraan: Number(r.spd_kph || 0),
      jenisMuatan: r.payload_type || "-",
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
        awal: r.loc_start || "-",
        akhir: r.loc_end || "-"
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
  let range = '-24h';
  let window = '1h';

  if (period === 'today') {
    range = '-24h';
    window = '12h'; // 2 shifts
  } else if (period === 'week') {
    range = '-7d';
    window = '1d';
  }

  try {
    const flux = `
      from(bucket: "${config.bucket}")
        |> range(start: ${range})
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> filter(fn: (r) => r._field == "cons_l_total" or r._field == "unit_state_code")
        |> aggregateWindow(every: ${window}, fn: mean, createEmpty: true)
    `;

    const rows = await queryApi.collectRows(flux);
    // This is simplified. Real statistics would need more complex aggregation.
    // For now, let's map what we can.
    
    const data = [];
    const timeMap = {};

    rows.forEach(r => {
      const timeLabel = toTZISO(new Date(r._time), TZ_OFFSET_MIN).split('T')[1].substring(0, 5);
      if (!timeMap[timeLabel]) {
        timeMap[timeLabel] = { label: timeLabel, fuel: 0, operating: 0, trip: 0, ob: 0 };
        data.push(timeMap[timeLabel]);
      }
      if (r._field === 'cons_l_total') timeMap[timeLabel].fuel += Number(r._value || 0);
      if (r._field === 'unit_state_code' && Number(r._value) > 0) timeMap[timeLabel].operating += 1;
    });

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
