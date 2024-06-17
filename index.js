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
async function findNearestDriver(pickupLocation) {
  let nearestDriver = null;
  let shortestDistance = Infinity;

  const activeDrivers = await Driver.find({ isActive: true });

  for (const driver of activeDrivers) {
    const distance = getDistance(pickupLocation, driver);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestDriver = driver;
    }
  }

  return nearestDriver;
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
    const driver = await Driver.find({ phoneNumber });
    if (driver) {
      driverSockets.set(phoneNumber, socket);
      console.log('Driver registered:', phoneNumber);
    } else {
      console.log('Driver not found for phone number:', phoneNumber);
    }
  });

  // Handle driver response to request
  // this listent by patient
  socket.on('requestAccepted', async (data) => {
    const driver = await Driver.findById(data.driverId);
    if (driver) {
      driver.isActive = false;
      await driver.save();
      // Emit the response back to the requesting client with driver details
      io.to(data.clientSocketId).emit('requestAccepted', {
        driverId: data.driverId,
        driverPhoneNumber: driver.phoneNumber
      });
      console.log(`Driver ${data.driverId} accepted request ${data.requestId}`);
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
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

// this is for the watching pateient request and serving to the nearest driver

  

  // Handle phoneNumber event
  // this is for the patient for
  // to provide live tracking
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


// this is for the watching pateient request and serving to the nearest driver
const requestChangeStream = PatientRequest.watch();

requestChangeStream.on('change', async (change) => {
  if (change.operationType === 'insert') {
    const newRequest = change.fullDocument;
    console.log('New request detected:', newRequest);

    const nearestDriver = await findNearestDriver(newRequest.pickupLocation);

    if (nearestDriver && driverSockets.has(nearestDriver.phoneNumber)) {
      const driverSocket = driverSockets.get(nearestDriver.phoneNumber);
      driverSocket.emit('newRequest', newRequest);
      console.log('Request dispatched to driver:', nearestDriver.phoneNumber);
    } 
    else{
      console.log("else");
    }
    // if(nearestDriver!= undefined)
    //   {
    //     console.log(driverSockets);
    //     console.log("we found driver ");
    //     console.log(nearestDriver);
    //   }
    
  }
  else{
    console.log("Some Thing ishappen in patientRequest Document");
  }
});
// end for above
// Watch the request collection for new requests


const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});