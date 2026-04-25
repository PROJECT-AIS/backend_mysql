const normalizeInfluxUrl = () => {
  const explicitUrl = process.env.INFLUX_URL || process.env.INFLUXDB_URL;
  if (explicitUrl) return explicitUrl;

  const host = process.env.INFLUXDB_HOST || "influxdb";
  if (/^https?:\/\//i.test(host)) return host;

  const isLocalHost = host === "influxdb" || host === "localhost" || host.startsWith("127.");
  const protocol = process.env.INFLUXDB_PROTOCOL || (isLocalHost ? "http" : "https");
  const port = process.env.INFLUXDB_PORT || (isLocalHost ? "8086" : "");
  const portSuffix = port ? `:${port}` : "";

  return `${protocol}://${host}${portSuffix}`;
};

const getInfluxConfig = () => ({
  url: normalizeInfluxUrl(),
  token: process.env.INFLUX_TOKEN || process.env.INFLUXDB_TOKEN,
  org: process.env.INFLUX_ORG || process.env.INFLUXDB_ORG || "my-org",
  bucket: process.env.INFLUX_BUCKET || process.env.INFLUXDB_BUCKET || "iot_data",
});

module.exports = {
  getInfluxConfig,
};
