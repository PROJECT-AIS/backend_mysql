// backend_mysql/utils/telemetryBridge.js
const { client } = require('./mqttClient');
const influxWriteApi = require('../db/influxdb_connection');
const { Point } = require('@influxdata/influxdb-client');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const unitStateLabel = {
    0: 'MATI',
    1: 'IDLE',
    2: 'AKTIF',
};

const tripSessionByVehicle = new Map();

const toNumberOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const isNonEmpty = (value) => {
    const s = String(value || '').trim();
    return s !== '' && s !== '-';
};

const normalizeTripStatus = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'end_trip';

    if (
        raw === 'on trip' ||
        raw === 'on_trip' ||
        raw === 'ontrip' ||
        raw === 'start trip' ||
        raw === 'start_trip' ||
        raw === 'terbuka' ||
        raw === 'aktif'
    ) {
        return 'on_trip';
    }

    if (
        raw === 'end trip' ||
        raw === 'end_trip' ||
        raw === 'endtrip' ||
        raw === 'close trip' ||
        raw === 'close_trip' ||
        raw === 'tertutup' ||
        raw === 'selesai' ||
        raw === 'mati'
    ) {
        return 'end_trip';
    }

    if (raw.includes('on') && raw.includes('trip')) return 'on_trip';
    if ((raw.includes('end') || raw.includes('close')) && raw.includes('trip')) return 'end_trip';

    return 'unknown';
};

const formatDuration = (startAt, endAt) => {
    if (!startAt || !endAt) return '-';
    const diffMs = Math.max(0, endAt.getTime() - startAt.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

const toLocalDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toIso = (date) => {
    return new Date(date).toISOString();
};
const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const r = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return r * c;
};

const resolveOperator = async (operatorUid, fallbackName = '-') => {
    if (!isNonEmpty(operatorUid)) {
        return {
            idOperator: '-',
            namaOperator: isNonEmpty(fallbackName) ? fallbackName : '-',
        };
    }

    try {
        const op = await prisma.operatorNfc.findFirst({
            where: { idCardNfc: String(operatorUid) },
        });

        if (op) {
            return {
                idOperator: op.idOperator || String(operatorUid),
                namaOperator: op.nama || fallbackName || '-',
            };
        }
    } catch (error) {
        console.warn('[TelemetryBridge] resolveOperator error:', error.message);
    }

    return {
        idOperator: String(operatorUid),
        namaOperator: isNonEmpty(fallbackName) ? fallbackName : '-',
    };
};

const resolveAlat = async (vehicleId) => {
    try {
        const alat = await prisma.alat.findFirst({
            where: { idFms: String(vehicleId) },
        });

        if (alat) {
            return {
                idAlat: alat.idFms,
                noPol: alat.noUnit || '-',
                jenisAlat: alat.jenisAlat || '-',
                merekAlat: alat.merk || '-',
            };
        }
    } catch (error) {
        console.warn('[TelemetryBridge] resolveAlat error:', error.message);
    }

    return {
        idAlat: String(vehicleId),
        noPol: '-',
        jenisAlat: '-',
        merekAlat: '-',
    };
};

const resolveFinishLocation = async (explicitFinish, lat, lon, fallbackFinish = null) => {
    if (isNonEmpty(explicitFinish)) return String(explicitFinish);
    if (isNonEmpty(fallbackFinish)) return String(fallbackFinish);

    const latNum = toNumberOrNull(lat);
    const lonNum = toNumberOrNull(lon);
    if (latNum == null || lonNum == null) return '-';

    try {
        const lokasiRows = await prisma.lokasi.findMany({
            select: { name: true, latitude: true, longitude: true, radius: true },
        });

        let nearest = null;
        for (const lokasi of lokasiRows) {
            const lLat = toNumberOrNull(lokasi.latitude);
            const lLon = toNumberOrNull(lokasi.longitude);
            if (lLat == null || lLon == null) continue;

            const distance = haversineDistanceMeters(latNum, lonNum, lLat, lLon);
            const radiusMeters = Number(lokasi.radius || 0);

            const score = radiusMeters > 0 && distance <= radiusMeters ? distance - 1000000 : distance;
            if (!nearest || score < nearest.score) {
                nearest = { name: lokasi.name, score };
            }
        }

        return nearest?.name || '-';
    } catch (error) {
        console.warn('[TelemetryBridge] resolveFinishLocation error:', error.message);
        return '-';
    }
};

const persistCompletedRetase = async ({
    vehicleId,
    tripStart,
    tripEnd,
    statusTrip,
    lokasiAwal,
    lokasiAkhir,
    jenisMuatan,
    operatorUid,
    operatorName,
    lat,
    lon,
    speed,
    fuelVol,
    fuelCons,
    fuelIn,
    fuelAnomaly,
    unitStateCode,
    fallbackFinishLocation,
}) => {
    try {
        const [alatInfo, operatorInfo, existingCount] = await Promise.all([
            resolveAlat(vehicleId),
            resolveOperator(operatorUid, operatorName),
            prisma.dataTrip.count({
                where: { idAlat: String(vehicleId) },
            }),
        ]);

        // Get the very last trip to chain the location
        const lastTrip = await prisma.dataTrip.findFirst({
            where: { idAlat: String(vehicleId) },
            orderBy: { id: 'desc' }
        });

        let finalLokasiAwal = isNonEmpty(lokasiAwal) ? String(lokasiAwal) : '-';
        // Alur trip berantai dipakai sebagai fallback, bukan override paksa.
        // Jadi jika lokasi awal trip baru valid dari payload, tetap dipakai.
        if (!isNonEmpty(finalLokasiAwal) && lastTrip && isNonEmpty(lastTrip.lokasiFinish)) {
            finalLokasiAwal = String(lastTrip.lokasiFinish);
        }

        const resolvedFinishLocation = await resolveFinishLocation(lokasiAkhir, lat, lon, fallbackFinishLocation);
        const durasi = formatDuration(tripStart, tripEnd);

        // Anti-duplikasi: cegah penyimpanan trip identik yang terkirim berulang
        // dalam rentang waktu berdekatan.
        if (lastTrip) {
            const lastFinishMs = new Date(lastTrip.waktuFinish || 0).getTime();
            const currentFinishMs = new Date(tripEnd).getTime();
            const sameStart = String(lastTrip.lokasiStart || '-') === String(finalLokasiAwal || '-');
            const sameFinish = String(lastTrip.lokasiFinish || '-') === String(resolvedFinishLocation || '-');
            const sameDuration = String(lastTrip.durasi || '-') === String(durasi || '-');
            const nearInTime =
                Number.isFinite(lastFinishMs) &&
                Number.isFinite(currentFinishMs) &&
                Math.abs(currentFinishMs - lastFinishMs) <= 120000; // 2 menit

            if (sameStart && sameFinish && sameDuration && nearInTime) {
                console.log(`[TelemetryBridge] Skip duplicate retase for ${vehicleId}`);
                return;
            }
        }

        const tripNumber = existingCount + 1;
        const tripLabel = String(tripNumber);

        await prisma.dataTrip.create({
            data: {
                idAlat: String(vehicleId),
                trip: tripLabel,
                tanggal: toLocalDate(tripEnd),
                lokasiStart: finalLokasiAwal,
                lokasiFinish: resolvedFinishLocation,
                namaOperator: operatorInfo.namaOperator,
                idOperator: operatorInfo.idOperator,
                jenisMuatan: isNonEmpty(jenisMuatan) ? String(jenisMuatan) : '-',
                waktuStart: toIso(tripStart),
                waktuFinish: toIso(tripEnd),
                durasi,
            },
        });

        await prisma.dataLog.create({
            data: {
                waktu: tripEnd,
                idAlat: alatInfo.idAlat,
                noPol: alatInfo.noPol,
                jenisAlat: alatInfo.jenisAlat,
                merekAlat: alatInfo.merekAlat,
                trip: tripLabel,
                latitude: lat != null ? String(lat) : '-',
                longitude: lon != null ? String(lon) : '-',
                kecepatan: toNumberOrNull(speed) || 0,
                jenisMuatan: isNonEmpty(jenisMuatan) ? String(jenisMuatan) : '-',
                volumeFuel: toNumberOrNull(fuelVol),
                konsumsiFuel: toNumberOrNull(fuelCons),
                anomaliStatusFuel: fuelAnomaly ? 'ANOMALI' : 'NORMAL',
                fuelMasuk: toNumberOrNull(fuelIn),
                statusAlat: unitStateLabel[Number(unitStateCode)] || 'MATI',
                start: toIso(tripStart),
                rentangWaktuAktif: `${toIso(tripStart)} - ${toIso(tripEnd)}`,
                durasiAktif: durasi,
                rentangWaktuPassif: '-',
                durasiPassif: '-',
                mati: Number(unitStateCode) === 0 ? 'YA' : '-',
                namaOperator: operatorInfo.namaOperator,
                idOperator: operatorInfo.idOperator,
                statusTrip: statusTrip || 'END TRIP',
            },
        });

        console.log(`[TelemetryBridge] Retase tercatat untuk ${vehicleId}. Trip #${tripLabel}`);
    } catch (error) {
        console.error('[TelemetryBridge] Error persist retase:', error.message);
    }
};

function initTelemetryBridge() {
    if (!client) {
        console.error('[TelemetryBridge] MQTT client not available');
        return;
    }

    const topic = 'fms/+/data';
    client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
            console.error('[TelemetryBridge] Subscribe failed:', err);
        } else {
            console.log(`[TelemetryBridge] Subscribed to ${topic}`);
        }
    });

    client.on('message', (receivedTopic, message) => {
        const parts = receivedTopic.split('/');
        if (!(parts.length === 3 && parts[0] === 'fms' && parts[2] === 'data')) return;

        const vehicleId = parts[1];

        try {
            const data = JSON.parse(message.toString());

            const lat = data.gps?.lat ?? data.lat;
            const lon = data.gps?.lon ?? data.gps?.lng ?? data.lon ?? data.lng;
            const speed = data.gps?.speed_kph ?? data.speed;
            const heading = data.imu?.orientation?.heading ?? data.imu?.heading ?? data.gps?.course ?? data.gps?.heading ?? data.course ?? data.heading;

            const fuelVol = data.fuel?.volume_l ?? data.fuel?.level;
            const fuelCons = data.fuel?.consumption_l ?? data.cons_l_total;
            const fuelAnomalyRaw = data.fuel?.anomaly ?? data.fuel_anomaly;
            const fuelAnomaly = String(fuelAnomalyRaw) === 'true' || Number(fuelAnomalyRaw) === 1;
            const fuelIn = data.fuel?.in ?? data.fuel_in;

            const operatorUid = data.nfc?.last_uid ?? data.operator_id ?? data.operator?.id;
            const operatorName = data.operator_name ?? data.operator?.name ?? '-';

            const statusTripRaw = data.operator_input?.status_trip ?? data.status_trip ?? data.payload_status ?? 'End Trip';
            const statusTripNormalized = normalizeTripStatus(statusTripRaw);
            const statusTripLabel = statusTripNormalized === 'on_trip'
                ? 'ON TRIP'
                : statusTripNormalized === 'end_trip'
                    ? 'END TRIP'
                    : String(statusTripRaw || '-').toUpperCase();

            const lokasiAwal = data.operator_input?.lokasi_awal ?? data.lokasi_awal ?? data.loc_start;
            const lokasiAkhir = data.operator_input?.lokasi_akhir ?? data.lokasi_akhir ?? data.loc_end ?? data.geofence?.name;
            const jenisMuatan = data.operator_input?.jenis_muatan ?? data.jenis_muatan ?? data.payload_type;

            let timestamp = new Date();
            if (data.timestamp_ms) {
                timestamp = new Date(data.timestamp_ms);
            } else if (data.time) {
                const parsed = new Date(data.time);
                if (!Number.isNaN(parsed.getTime())) timestamp = parsed;
            }

            const speedNum = toNumberOrNull(speed) || 0;
            const hasValidGps = toNumberOrNull(lat) != null && toNumberOrNull(lon) != null;

            const prevState = tripSessionByVehicle.get(vehicleId) || {
                lastStatus: 'end_trip',
                tripStartTime: null,
                maxSpeed: 0,
                startLokasiAwal: null,
                startJenisMuatan: null,
                startOperatorUid: null,
                startOperatorName: null,
                sessionTripNo: 0,
                activeTripTag: null,
                tripLastLokasiAkhir: null,
                lastLokasiAkhir: null,
                lastPersistedEndTag: null,
                lastPersistedEndAt: null,
            };

            const nextState = { ...prevState };
            const effectiveTripStatus = statusTripNormalized === 'unknown' ? prevState.lastStatus : statusTripNormalized;

            if (isNonEmpty(lokasiAkhir)) {
                nextState.lastLokasiAkhir = String(lokasiAkhir);
                if (effectiveTripStatus === 'on_trip') {
                    nextState.tripLastLokasiAkhir = String(lokasiAkhir);
                }
            }

            if (effectiveTripStatus === 'on_trip') {
                if (prevState.lastStatus !== 'on_trip') {
                    nextState.tripStartTime = timestamp;
                    nextState.maxSpeed = 0;
                    nextState.startLokasiAwal = isNonEmpty(lokasiAwal) ? String(lokasiAwal) : prevState.startLokasiAwal;
                    nextState.startJenisMuatan = isNonEmpty(jenisMuatan) ? String(jenisMuatan) : prevState.startJenisMuatan;
                    nextState.startOperatorUid = isNonEmpty(operatorUid) ? String(operatorUid) : prevState.startOperatorUid;
                    nextState.startOperatorName = isNonEmpty(operatorName) ? String(operatorName) : prevState.startOperatorName;
                    nextState.tripLastLokasiAkhir = isNonEmpty(lokasiAkhir) ? String(lokasiAkhir) : null;
                    if (isNonEmpty(data.trip_id)) {
                        nextState.activeTripTag = String(data.trip_id);
                    } else {
                        nextState.sessionTripNo = (prevState.sessionTripNo || 0) + 1;
                        nextState.activeTripTag = String(nextState.sessionTripNo);
                    }
                } else if (isNonEmpty(data.trip_id)) {
                    nextState.activeTripTag = String(data.trip_id);
                }

                if (speedNum > nextState.maxSpeed) {
                    nextState.maxSpeed = speedNum;
                }
            }

            if (prevState.lastStatus === 'on_trip' && effectiveTripStatus === 'end_trip') {
                const tripStart = prevState.tripStartTime || timestamp;
                const tripEnd = timestamp;

                persistCompletedRetase({
                    vehicleId,
                    tripStart,
                    tripEnd,
                    statusTrip: statusTripLabel,
                    lokasiAwal: prevState.startLokasiAwal || lokasiAwal,
                    lokasiAkhir,
                    jenisMuatan: prevState.startJenisMuatan || jenisMuatan,
                    operatorUid: prevState.startOperatorUid || operatorUid,
                    operatorName: prevState.startOperatorName || operatorName,
                    lat,
                    lon,
                    speed: Math.max(prevState.maxSpeed || 0, speedNum),
                    fuelVol,
                    fuelCons,
                    fuelIn,
                    fuelAnomaly,
                    unitStateCode: data.unit_state_code ?? data.state_code,
                    fallbackFinishLocation: prevState.tripLastLokasiAkhir || prevState.lastLokasiAkhir,
                }).catch((error) => {
                    console.error('[TelemetryBridge] persistCompletedRetase unhandled:', error.message);
                });

                nextState.tripStartTime = null;
                nextState.maxSpeed = 0;
                nextState.startLokasiAwal = null;
                nextState.startJenisMuatan = null;
                nextState.startOperatorUid = null;
                nextState.startOperatorName = null;
                nextState.activeTripTag = null;
                nextState.tripLastLokasiAkhir = null;
                nextState.lastPersistedEndTag = String(data.trip_id ?? prevState.activeTripTag ?? `${tripEnd.getTime()}`);
                nextState.lastPersistedEndAt = tripEnd.getTime();
            }

            // NONAKTIFKAN fallback persist END TRIP.
            // Alasan: fallback dapat menyimpan rute lama/stale saat paket END TRIP berulang
            // atau saat state ON TRIP tidak sinkron, sehingga Info Trip menjadi tidak akurat.
            // Penyimpanan trip kini hanya dari transisi valid ON TRIP -> END TRIP di atas.

            nextState.lastStatus = effectiveTripStatus;
            tripSessionByVehicle.set(vehicleId, nextState);

            const point = new Point('telemetry')
                .tag('vehicle_id', vehicleId)
                .tag('device_id', data.device_id || 'unknown');

            const addField = (fieldName, value) => {
                if (value === undefined || value === null) return;
                if (typeof value === 'number') point.floatField(fieldName, value);
                else if (typeof value === 'boolean') point.booleanField(fieldName, value);
                else point.stringField(fieldName, String(value));
            };

            addField('lat', lat);
            addField('lon', lon);
            addField('spd_kph', speed);
            addField('heading_deg', heading);

            addField('fuel_vol_l', fuelVol);
            addField('cons_l_total', fuelCons);
            addField('fuel_anomaly', fuelAnomaly ? 1 : 0); // Cast to number to match InfluxDB float type
            addField('fuel_in', fuelIn);

            addField('unit_state_code', data.unit_state_code ?? data.state_code);

            addField('operator_id', operatorUid);
            addField('operator_name', operatorName);
            addField('operator_role', data.operator_role);
            addField('operator_division', data.operator_division);

            addField('trip_id', data.trip_id ?? nextState.activeTripTag ?? prevState.activeTripTag);
            addField('status_trip', statusTripLabel);
            addField('lokasi_awal', lokasiAwal);
            addField('lokasi_akhir', lokasiAkhir);
            addField('jenis_muatan', jenisMuatan);
            addField('payload_type', data.payload_type ?? jenisMuatan);
            addField('payload_status', data.payload_status);

            addField('esp_v_batt', data.esp_v_batt ?? data.battery?.esp_v);
            addField('esp_i_sys', data.esp_i_sys ?? data.battery?.esp_i);

            point.timestamp(timestamp);

            influxWriteApi.writePoint(point);
            influxWriteApi.flush().catch((error) => {
                console.error('[TelemetryBridge] Flush Error:', error);
            });

            if (hasValidGps) {
                console.log(`[TelemetryBridge] Data saved for ${vehicleId}: lat=${lat}, lon=${lon}, status=${statusTripLabel}`);
            }
        } catch (error) {
            console.error(`[TelemetryBridge] Error processing message for ${vehicleId}:`, error.message);
        }
    });
}

module.exports = { initTelemetryBridge };
