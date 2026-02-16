const { client } = require('../utils/mqttClient');

// Cache untuk store latest full config per vehicle_id
const fullConfigCache = new Map();

// Subscribe ke config/set dan forward ke config (retained)
function initConfigBridge() {
    if (!client) {
        console.error('[ConfigBridge] MQTT client not available');
        return;
    }

    // Subscribe ke fms/+/config untuk keep cache
    client.subscribe('fms/+/config', { qos: 0 }, (err) => {
        if (err) {
            console.error('[ConfigBridge] Subscribe config failed:', err);
        } else {
            console.log('[ConfigBridge] Subscribed to fms/+/config');
        }
    });

    // Subscribe ke fms/+/config/set untuk handle updates
    client.subscribe('fms/+/config/set', { qos: 1 }, (err) => {
        if (err) {
            console.error('[ConfigBridge] Subscribe config/set failed:', err);
        } else {
            console.log('[ConfigBridge] Subscribed to fms/+/config/set');
        }
    });

    // Handle incoming messages
    client.on('message', (topic, message) => {
        const parts = topic.split('/');

        // Handle fms/TRK-001/config (cache full config)
        if (parts.length === 3 && parts[0] === 'fms' && parts[2] === 'config') {
            const vehicleId = parts[1];
            try {
                const config = JSON.parse(message.toString());
                fullConfigCache.set(vehicleId, config);
                console.log(`[ConfigBridge] Cached full config for ${vehicleId}`);
            } catch (e) {
                console.error(`[ConfigBridge] Parse config failed for ${vehicleId}:`, e.message);
            }
        }

        // Handle fms/TRK-001/config/set (update and republish)
        if (parts.length === 4 && parts[0] === 'fms' && parts[2] === 'config' && parts[3] === 'set') {
            const vehicleId = parts[1];
            try {
                const updates = JSON.parse(message.toString());
                console.log(`[ConfigBridge] ====================================`);
                console.log(`[ConfigBridge] Received config/set for ${vehicleId}`);
                console.log(`[ConfigBridge] Updates payload:`, JSON.stringify(updates, null, 2));

                // Get existing config atau create new
                let fullConfig = fullConfigCache.get(vehicleId) || {
                    vehicle_id: vehicleId,
                    device_id: 'FMS-VCU-001',
                    version: 1
                };

                console.log(`[ConfigBridge] Existing config version: ${fullConfig.version}`);

                // Merge updates dengan existing config
                fullConfig = mergeConfig(fullConfig, updates);

                // Update cache
                fullConfigCache.set(vehicleId, fullConfig);

                // Publish full config ke fms/{vehicle_id}/config dengan retain=true
                const configTopic = `fms/${vehicleId}/config`;
                const payload = JSON.stringify(fullConfig);

                client.publish(configTopic, payload, { qos: 0, retain: true }, (err) => {
                    if (err) {
                        console.error(`[ConfigBridge] Publish failed for ${vehicleId}:`, err);
                    } else {
                        console.log(`[ConfigBridge] Published full config to ${configTopic} (retained, version: ${fullConfig.version})`);
                        console.log(`[ConfigBridge] ====================================`);
                    }
                });

            } catch (e) {
                console.error(`[ConfigBridge] Process config/set failed for ${vehicleId}:`, e.message);
            }
        }
    });
}

// Merge updates ke existing config (deep merge untuk nested objects)
function mergeConfig(existing, updates) {
    const merged = JSON.parse(JSON.stringify(existing)); // deep clone
    let hasChanges = false;
    let versionManuallySet = false;

    for (const key in updates) {
        if (updates.hasOwnProperty(key)) {
            // Skip timestamp dan type - dikelola otomatis
            if (key === 'timestamp_ms' || key === 'type') {
                continue;
            }

            // Handle version secara khusus (langsung set, tidak increment)
            if (key === 'version') {
                if (updates[key] !== merged[key]) {
                    merged[key] = updates[key];
                    versionManuallySet = true;
                    console.log(`[ConfigBridge] Version manually set to ${merged[key]}`);
                }
                continue;
            }

            if (typeof updates[key] === 'object' && !Array.isArray(updates[key]) && updates[key] !== null) {
                // Nested object, check if values actually changed
                const existingNested = merged[key] || {};
                let nestedChanged = false;
                
                for (const nestedKey in updates[key]) {
                    if (existingNested[nestedKey] !== updates[key][nestedKey]) {
                        nestedChanged = true;
                        break;
                    }
                }
                
                if (nestedChanged) {
                    hasChanges = true;
                    // Merge nested object
                    merged[key] = { ...merged[key], ...updates[key] };
                }
            } else {
                // Primitive value atau array, check if changed
                if (merged[key] !== updates[key]) {
                    hasChanges = true;
                    merged[key] = updates[key];
                }
            }
        }
    }

    // Only increment version if actual changes AND version wasn't manually set
    if (hasChanges && !versionManuallySet) {
        merged.version = (merged.version || 0) + 1;
        console.log(`[ConfigBridge] Config changed, version incremented to ${merged.version}`);
    } else if (!hasChanges && !versionManuallySet) {
        console.log(`[ConfigBridge] No config changes detected, version remains ${merged.version || 0}`);
    }

    merged.timestamp_ms = Date.now();

    return merged;
}

// Initialize on module load
setTimeout(() => {
    initConfigBridge();
}, 2000);

module.exports = {
    fullConfigCache
};
