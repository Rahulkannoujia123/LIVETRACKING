const mongoose = require('mongoose');

const livetrackingdriverSchema = new mongoose.Schema({
    name: String,
    location: {
        latitude: Number,
        longitude: Number,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});

const Driver = mongoose.model('LivetrackingDriver', livetrackingdriverSchema);

module.exports = Driver;
