const { InfluxDB } = require('@influxdata/influxdb-client');
const { getInfluxConfig } = require('../db/influxConfig');

const escapeFluxString = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const createQueryApi = () => {
  const config = getInfluxConfig();
  const influx = new InfluxDB({ url: config.url, token: config.token });

  return {
    config,
    queryApi: influx.getQueryApi(config.org),
  };
};

const health = async (req, res) => {
  const { config, queryApi } = createQueryApi();

  if (!config.token) {
    return res.status(500).json({
      ok: false,
      error: 'INFLUXDB_TOKEN is not configured',
      url: config.url,
      org: config.org,
      bucket: config.bucket,
    });
  }

  try {
    const rows = await queryApi.collectRows(`
      buckets()
        |> filter(fn: (r) => r.name == "${escapeFluxString(config.bucket)}")
        |> limit(n: 1)
    `);

    return res.json({
      ok: rows.length > 0,
      url: config.url,
      org: config.org,
      bucket: config.bucket,
      bucketFound: rows.length > 0,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      url: config.url,
      org: config.org,
      bucket: config.bucket,
      error: err?.message || String(err),
    });
  }
};

const schema = async (req, res) => {
  const { config, queryApi } = createQueryApi();
  const measurement = req.query.measurement || 'telemetry';
  const rangeParam = String(req.query.range || '-30d');
  const rangeStart = /^-\d+[smhdw]$/.test(rangeParam) ? rangeParam : '-30d';

  try {
    const [measurements, fields, tagKeys] = await Promise.all([
      queryApi.collectRows(`
        import "influxdata/influxdb/schema"

        schema.measurements(bucket: "${escapeFluxString(config.bucket)}")
      `),
      queryApi.collectRows(`
        import "influxdata/influxdb/schema"

        schema.fieldKeys(
          bucket: "${escapeFluxString(config.bucket)}",
          predicate: (r) => r._measurement == "${escapeFluxString(measurement)}",
          start: ${rangeStart}
        )
      `),
      queryApi.collectRows(`
        import "influxdata/influxdb/schema"

        schema.tagKeys(
          bucket: "${escapeFluxString(config.bucket)}",
          predicate: (r) => r._measurement == "${escapeFluxString(measurement)}",
          start: ${rangeStart}
        )
      `),
    ]);

    return res.json({
      bucket: config.bucket,
      measurement,
      measurements: measurements.map((row) => row._value).filter(Boolean),
      fields: fields.map((row) => row._value).filter(Boolean),
      tags: tagKeys.map((row) => row._value).filter(Boolean),
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
};

module.exports = {
  health,
  schema,
};
