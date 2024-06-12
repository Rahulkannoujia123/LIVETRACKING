const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

// Import the Driver model (assuming you have defined it in a separate file)
const driver = require('./src/model/driver.model');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Map to store driver's socket connections by phoneNumber
const driverSockets = new Map();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

// Set up a change stream to listen for changes in the Driver collection


// Socket.io connection event handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Listen for initial data (phoneNumber) from the client
  socket.on('phoneNumber', (phoneNumber) => {
    const changeStream = driver.watch();
    console.log(changeStream)
   console.log('Received phoneNumber:', phoneNumber);
   

changeStream.on('change', async (change) => {
  
  console.log('Change occurred:', change);

  // Extract the updated document from the change event
  const updatedDocument =  await driver.findById(change.documentKey._id);
  console.log('Updated Document:', updatedDocument);

  // Emit the updated document to all connected sockets
  io.emit('driverLocation', { latitude: updatedDocument.latitude, longitude: updatedDocument.longitude });
});
    // Store the socket connection with phoneNumber
    driverSockets.set(phoneNumber, socket);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Remove socket from driverSockets map when disconnected
    driverSockets.forEach((value, key) => {
      if (value === socket) {
        driverSockets.delete(key);
      }
    });
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});
