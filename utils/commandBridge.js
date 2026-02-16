// express-backend/utils/commandBridge.js
// Bridge untuk MQTT Command â†’ Queue (agar MQTT Explorer bisa kirim command)

const { client } = require('./mqttClient');

let commandQueue = null;

function initCommandBridge(queue) {
    commandQueue = queue;
    
    if (!client) {
        console.error('[CommandBridge] MQTT client not available');
        return;
    }

    // Subscribe ke fms/+/log/send untuk capture commands dari MQTT
    client.subscribe('fms/+/log/send', { qos: 1 }, (err) => {
        if (err) {
            console.error('[CommandBridge] Subscribe failed:', err);
        } else {
            console.log('[CommandBridge] Subscribed to fms/+/log/send');
        }
    });

    // Handle incoming MQTT messages
    client.on('message', (topic, message) => {
        // Handle fms/{vehicleId}/log/send
        if (topic.includes('/log/send')) {
            const parts = topic.split('/');
            if (parts.length === 4 && parts[0] === 'fms' && parts[2] === 'log' && parts[3] === 'send') {
                const vehicleId = parts[1];
                try {
                    const payload = JSON.parse(message.toString());
                    
                    // Hanya proses jika type=command dan ada cmd
                    if (payload.type === 'command' && payload.cmd) {
                        if (!commandQueue[vehicleId]) {
                            commandQueue[vehicleId] = [];
                        }
                        commandQueue[vehicleId].push(payload);
                        console.log(`[CommandBridge] Queued from MQTT: "${payload.cmd}" for ${vehicleId} (queue size: ${commandQueue[vehicleId].length})`);
                    }
                } catch (e) {
                    console.error(`[CommandBridge] Parse error for ${vehicleId}:`, e.message);
                }
            }
        }
    });
    
    console.log('[CommandBridge] Command bridge initialized');
}

module.exports = { initCommandBridge };
