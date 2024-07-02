const mongoose = require('mongoose');
const Driver = require('./driver.model');
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
        enum: ['accepted', 'pending', 'completed','cancelled'],
        default: 'pending'
    },
    driverPhoneNumber: String,
    driverName:String,
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed',],
        default: 'pending'
    },
    rating:Number,
    timestamp: {
        type: Date,
        default: Date.now
    },
    distance: Number, // New field to store distance in kilometers
    fare: Number,     // New field to store fare in Rs
});

const PatientRequest = mongoose.model('PatientRequest', patientrequestSchema);

module.exports = PatientRequest;
