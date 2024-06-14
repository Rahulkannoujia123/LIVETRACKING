const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const patientrequestSchema = new Schema({
    requestId: String,
    pickupLocation: {
        latitude: Number,
        longitude: Number
    },
    dropLocation: {
        latitude: Number,
        longitude: Number
    },
    patientName: String,
    patientPhoneNumber: String,
    rideStatus: {
        type: String,
        enum: ['accepted', 'pending', 'completed'],
        default: 'pending'
    },
    driverPhoneNumber: String,
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    distance: Number, // New field to store distance in kilometers
    fare: Number,     // New field to store fare in Rs
});

const PatientRequest = mongoose.model('PatientRequest', patientrequestSchema);

module.exports = PatientRequest;
