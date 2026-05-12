// utils/mqttClient.js
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'wss://mqtt.aispektra.com:443';

const client = mqtt.connect(MQTT_URL, {
  clientId: `express-backend-${Date.now()}`,
  protocolVersion: 4, // Force MQTT v3.1.1
  keepalive: 60,
  reconnectPeriod: 2000,
  connectTimeout: 30 * 1000, // 30 seconds
  clean: true,
});

let connected = false;

client.on('connect', () => {
  connected = true;
  console.log('[MQTT] express-backend connected');
});

client.on('disconnect', () => {
  connected = false;
  console.log('[MQTT] express-backend disconnected');
});

client.on('error', (e) => {
  console.error('[MQTT] error:', e?.message || e);
});

client.on('reconnect', () => {
  console.log('[MQTT] reconnecting...');
});

function publish(topic, payload, opts = { qos: 0, retain: false }) {
  return new Promise((resolve, reject) => {
    if (!connected) {
      return reject(new Error('MQTT client not connected'));
    }

    client.publish(topic, payload, opts, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

module.exports = { client, publish, isConnected: () => connected };
