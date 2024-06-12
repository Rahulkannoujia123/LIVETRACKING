const http = require('http');
const express = require('express');

const socketIo = require('socket.io');
const mongoose = require('mongoose');

// Import the Driver model (assuming you have defined it in a separate file)
const Driver = require('./src/model/driver.model');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
// console.log(app);
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
  // console.log(io);

// Socket.io connection event handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('phoneNumber', (phoneNumber) => {
    console.log('Received phoneNumber:', phoneNumber);

    // Store the socket connection with phoneNumber
    driverSockets.set(phoneNumber, socket);

    // Set up a change stream to listen for changes in the Driver collection
    const changeStream = Driver.watch();

    changeStream.on('change', async(change) => {
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

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});
