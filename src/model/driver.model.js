const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    phoneNumber: String,
    alternativeNumber: String,
    emailId: String,
    hospitalName: String,
    hospitalAddress: String,
    aadharCardFront: String,
    aadharCardBack: String,
    driverLicense: String,
    ambulancePhotoRear: String,
    ambulancePhotoBack: String,
    image: String,
    latitude:String,
    longitude:String, 
    rating: { type: Number, default: 0, min: 0, max: 5 },
    // Corrected image field definition
    isActive: {
        type: Boolean,
        default: true
    }
});

const Driver = mongoose.model('Driver', driverSchema);

module.exports = Driver;
