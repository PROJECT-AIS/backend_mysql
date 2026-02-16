const { fullConfigCache } = require('./configBridge');

// Get config from cache (populated by configBridge)
function getConfigForVehicle(vehicleId) {
    return fullConfigCache.get(vehicleId) || null;
}

module.exports = {
    getConfigForVehicle
};
