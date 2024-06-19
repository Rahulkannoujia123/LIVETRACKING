const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

// Import the necessary models
const Driver = require('./src/model/driver.model');
const PatientRequest = require('./src/model/patientrequest.model');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware to parse JSON bodies
app.use(express.json());

let driverSockets = new Map(); // Map to store driver's socket connections by phoneNumber
let clientSockets = new Map(); // Map to store client's socket connections by phoneNumber

// Function to calculate distance between two locations (Haversine formula)
function getDistance(loc1, loc2) {
  
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Radius of the Earth in kilometers

  const dLat = toRad(parseFloat(loc2.latitude) - parseFloat(loc1["latitude"]));
  const dLon = toRad(parseFloat(loc2.longitude )- parseFloat(loc1["longitude"]));
  const lat1 = toRad(parseFloat(loc1["latitude"]));
  const lat2 = toRad(parseFloat(loc2.latitude));

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// Function to find the nearest active driver
async function findNearestDriver(pickupLocation, excludedDriverNumber = []) {
  console.log("in findNearestDriver ()");
  
  let nearestDriver = null;
  let shortestDistance = Infinity;

  // Exclude the specific phone number if it's not already in the excluded list
  const specificDriverPhoneNumber = "9524672598";
  if (!excludedDriverNumber.includes(specificDriverPhoneNumber)) {
    excludedDriverNumber.push(specificDriverPhoneNumber);
  }

  const activeDrivers = await Driver.find({ isActive: true, phoneNumber: { $nin: excludedDriverNumber } });

  console.log(`Active drivers count: ${activeDrivers.length}`);
  if (activeDrivers.length === 0) {
    console.log('No active drivers available');
  }

  for (const driver of activeDrivers) {
    const distance = getDistance(pickupLocation, driver);
    console.log(`Distance to driver ${driver.phoneNumber}: ${distance} km`);
    
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestDriver = driver;
    }
  }
  
  console.log("end of the findNearestdata()");
  if (nearestDriver) {
    console.log(`Nearest driver found: ${nearestDriver.phoneNumber} at distance ${shortestDistance} km`);
  } else {
    console.log('No nearest driver found');
  }

  // Fetch data for the specific phone number "9524672598"
  const specificDriver = await Driver.findOne({ phoneNumber: specificDriverPhoneNumber });
  
  if (specificDriver) {
    console.log(`Specific driver data for phone number ${specificDriverPhoneNumber}:`, specificDriver);
  } else {
    console.log(`No driver found with phone number ${specificDriverPhoneNumber}`);
  }

  return { nearestDriver, specificDriver };
}


// Connect to MongoDB
mongoose.connect("mongodb+srv://Rahul:myuser@rahul.fack9.mongodb.net/Databaserahul?authSource=admin&replicaSet=atlas-117kuv-shard-0&w=majority&readPreference=primary&retryWrites=true&ssl=true")
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

// Socket.io connection event handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('registerDriver', async (phoneNumber) => {
    console.log(phoneNumber);
    const driver = await Driver.findOne({ phoneNumber });
    if (driver) {
      driverSockets.set(phoneNumber, socket);
      console.log('Driver registered:', phoneNumber);
    } else {
      console.log('Driver not found for phone number:', phoneNumber);
    }
  });

  socket.on('registerClient', (phoneNumber) => {
    console.log(phoneNumber);
    clientSockets.set(phoneNumber, socket);
    console.log('Client registered:', phoneNumber);
  });

  // Handle driver response to request
  socket.on('requestAccepted', async (data) => {
    console.log("in requestAccepted event =================");
    console.log(data);
    console.log("this is the type of the data");
    console.log(typeof data);
    const driver = await Driver.findOne({ phoneNumber: data.driverPhoneNumber });

    console.log("after finding the data from db =================");

    console.log(driver);
    if (driver) {
      driver.isActive = false;
      await driver.save();
      const request = await PatientRequest.findOne({ requestId: data.requestId });

      if (request) {
        // Update the patient request with the ride status, driver number, and driver name
        request.rideStatus = 'accepted';
        request.driverPhoneNumber = driver.phoneNumber;
        request.driverName = driver.name;
        await request.save();

        const clientSocket = clientSockets.get(request.patientPhoneNumber);
        if (clientSocket) {
          // Emit the updated request details to the client
          clientSocket.emit('requestAccepted', {
            driverId: data.driverId,
            driverPhoneNumber: driver.phoneNumber,
            driverName: driver.name,
            requestDetails: request
          });
        }
        console.log(`Driver ${data.driverId} accepted request ${data.requestId}`);
      }
    }
  });

  // Handle driver denying the request
  socket.on('requestDenied', async (data) => {
    console.log(`Driver ${data.driverPhoneNumber} denied request ${data.requestId}`);
    const deniedDriverId = data.driverPhoneNumber;
    const patientRequest = await PatientRequest.findOne({ requestId: data.requestId });


    if (patientRequest) {
      console.log("in if condistion");
      // Find the next nearest driver excluding the denied driver
      const nearestDriver = await findNearestDriver(patientRequest.pickupLocation, [deniedDriverId]);
      console.log(nearestDriver);

      if (nearestDriver && driverSockets.has(nearestDriver.phoneNumber)) {
        const driverSocket = driverSockets.get(nearestDriver.phoneNumber);
        driverSocket.emit('newRequest', patientRequest);
        console.log('Request reassigned to driver:', nearestDriver.phoneNumber);
      } else {
        console.log('No available drivers to reassign the request');
      }
    }
  });
// cancel ride kal karege
  socket.on('cancelRide', async (data) => {
    try {
      console.log(`Patient ${data.patientPhoneNumber} cancelled request ${data.requestId}`);
  
      // Find the patient request
      const patientRequest = await PatientRequest.findOne({ requestId: data.requestId });
  
      if (patientRequest) {
        // Update the rideStatus to 'cancelled'
        patientRequest.rideStatus = 'cancelled';
        await patientRequest.save();
  
        // Retrieve driver's socket using stored phoneNumber
        const driverSocket = driverSockets.get(patientRequest.driverPhoneNumber);
  
        if (driverSocket) {
          // Emit the cancellation event to the driver
          driverSocket.emit('rideCancelled', { requestId: data.requestId });
          console.log(`Notified driver ${patientRequest.driverPhoneNumber} about cancellation of request ${data.requestId}`);
        } else {
          console.log(`Driver socket not found for phone number: ${patientRequest.driverPhoneNumber}`);
        }
      } else {
        console.log(`Patient request not found for requestId: ${data.requestId}`);
      }
    } catch (error) {
      console.error('Error handling cancelRide event:', error);
    }
  });
  socket.on('completeRide', async (data) => {
    try {
      console.log(`Driver completed ride for request ${data.requestId}`);
  
      // Find the patient request
      const patientRequest = await PatientRequest.findOne({ requestId: data.requestId });
  
      if (patientRequest) {
        // Update the rideStatus to 'completed'
        patientRequest.rideStatus = 'completed';
        await patientRequest.save();
  
        // Emit the completed ride details to the patient
        const patientSocket = clientSockets.get(patientRequest.patientPhoneNumber);
        if (patientSocket) {
          patientSocket.emit('rideCompleted', patientRequest);
          console.log(`Notified patient ${patientRequest.patientPhoneNumber} about completion of request ${data.requestId}`);
        } else {
          console.log(`Patient socket not found for phone number: ${patientRequest.patientPhoneNumber}`);
        }
  
        // Emit the completed ride details to the driver
        const driverSocket = driverSockets.get(patientRequest.driverPhoneNumber);
        if (driverSocket) {
          driverSocket.emit('rideCompleted', patientRequest);
          console.log(`Notified driver ${patientRequest.driverPhoneNumber} about completion of request ${data.requestId}`);
        } else {
          console.log(`Driver socket not found for phone number: ${patientRequest.driverPhoneNumber}`);
        }
      } else {
        console.log(`Patient request not found for requestId: ${data.requestId}`);
      }
    } catch (error) {
      console.error('Error handling completeRide event:', error);
    }
  });
  socket.on('dropOff', async (data) => {
    try {
      console.log(`Driver notified drop-off for request ${data.requestId}`);
  
      // Find the patient request
      const patientRequest = await PatientRequest.findOne({ requestId: data.requestId });
  
      if (patientRequest) {
        // Emit the drop-off notification to the patient
        const patientSocket = clientSockets.get(patientRequest.patientPhoneNumber);
        if (patientSocket) {
          patientSocket.emit('dropOffNotified', { requestId: data.requestId });
          console.log(`Notified patient ${patientRequest.patientPhoneNumber} about drop-off for request ${data.requestId}`);
        } else {
          console.log(`Patient socket not found for phone number: ${patientRequest.patientPhoneNumber}`);
        }
      } else {
        console.log(`Patient request not found for requestId: ${data.requestId}`);
      }
    } catch (error) {
      console.error('Error handling dropOff event:', error);
    }
  });
  

  

  // Handle driver disconnection
  socket.on('disconnect', () => {
    for (const [phoneNumber, driverSocket] of driverSockets.entries()) {
      if (driverSocket === socket) {
        driverSockets.delete(phoneNumber);
        console.log('Driver disconnected:', phoneNumber);
        break;
      }
    }
    for (const [phoneNumber, clientSocket] of clientSockets.entries()) {
      if (clientSocket === socket) {
        clientSockets.delete(phoneNumber);
        console.log('Client disconnected:', phoneNumber);
        break;
      }
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Handle phoneNumber event
  socket.on('phoneNumber', (phoneNumber) => {
    console.log('Received phoneNumber:', phoneNumber);

    // Store the socket connection with phoneNumber
    driverSockets.set(phoneNumber, socket);

    // Set up a change stream to listen for changes in the Driver collection
    const changeStream = Driver.watch();

    changeStream.on('change', async (change) => {
      console.log('Change occurred:', change);

      // Extract the updated document from the change event
      const updatedDocument = await Driver.findById(change.documentKey._id);
      console.log('Updated Document:', updatedDocument);

      // Emit the updated document to the specific client's socket
      if (updatedDocument) {
        socket.emit('driverLocation', { latitude: updatedDocument.latitude, longitude: updatedDocument.longitude });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Remove socket from driverSockets map when disconnected
      driverSockets.forEach((value, key) => {
        if (value === socket) {
          driverSockets.delete(key);
        }
      });
      changeStream.close();
    });
  });
});

// Watch the request collection for new requests
const requestChangeStream = PatientRequest.watch();

requestChangeStream.on('change', async (change) => {
  if (change.operationType === 'insert') {
    const newRequest = change.fullDocument;
    console.log('New request detected:', newRequest);

    // Retrieve the specific driver by phone number
    const driverPhoneNumber = '9524672598'; // Replace with the actual driver's phone number
    const driver = await Driver.findOne({ phoneNumber: driverPhoneNumber });

    if (!driver) {
      console.log(`Driver with phone number ${driverPhoneNumber} not found`);
      return;
    }

    // Check if the driver is active and available
    if (driver.isActive) {
      // Emit the request to the driver if their socket connection exists
      if (driverSockets.has(driver.phoneNumber)) {
        const driverSocket = driverSockets.get(driver.phoneNumber);
        driverSocket.emit('newRequest', newRequest);
        console.log('Request dispatched to driver:', driver.phoneNumber);
      } else {
        console.log(`Driver ${driver.phoneNumber} `);
      }
    } else {
      console.log(`Driver ${driver.phoneNumber} is not active`);
      // Handle case where driver is not active
    }
  } else {
    console.log('Something happened with PatientRequest document');
  }
});


const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});