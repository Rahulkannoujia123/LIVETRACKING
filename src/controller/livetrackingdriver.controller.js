const LivetrackingDriver = require('../model/livetrackingdriver.model');
const io = require('../../index');
const driver=require('../model/driver.model')
exports. addDriverLocation = async (req, res) => {
    const { phoneNumber, latitude, longitude } = req.body;

    try {
        // Check if driver already exists
        let driver = await driver.findOne({ phoneNumber });
        if (driver) {
            return res.status(400).json({ success: false, message: 'Driver already exists' });
        }

        // Create a new driver entry
        driver = new LivetrackingDriver({
            phoneNumber,
            location: {
                latitude,
                longitude
            },
            lastUpdated: Date.now()
        });

        // Save the new driver entry
        await driver.save();

        // Emit new driver location to all clients
        io.emit('locationUpdate', {
            phoneNumber,
            location: driver.location,
        });

        res.status(200).json({ success: true, message: 'Driver location added successfully' });
    } catch (error) {
        console.error('Error adding driver location:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};
// Update driver's location
const updateDriverLocation = async (req, res) => {
    const { poneNumber, latitude, longitude } = req.body;

    try {
        const driver = await driver.findById(poneNumber);
        if (!driver) {
            return res.status(404).send('Driver not found');
        }

        driver.location.latitude = latitude;
        driver.location.longitude = longitude;
        driver.lastUpdated = Date.now();
        await LivetrackingDriver.save();

        // Emit updated location to all clients
        io.emit('locationUpdate', {
            phoneNumber: poneNumber,
            location: driver.location,
        });

        res.status(200).send('Location updated successfully');
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};

// Get driver's location and estimate arrival time
const getDriverLocation = async (req, res) => {
    const { driverId, destinationLatitude, destinationLongitude } = req.query;

    try {
        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).send('Driver not found');
        }

        const { latitude, longitude } = driver.location;

        // Estimate time (for simplicity, using direct distance calculation, in real application use proper routing service)
        const distance = getDistanceFromLatLonInKm(latitude, longitude, destinationLatitude, destinationLongitude);
        const averageSpeed = 50; // Assuming average speed in km/h
        const timeToArrival = distance / averageSpeed;

        res.status(200).json({
            location: driver.location,
            timeToArrival: timeToArrival * 60, // converting hours to minutes
        });
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};

// Helper function to calculate distance
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

module.exports = {
    updateDriverLocation,
    getDriverLocation,
};
