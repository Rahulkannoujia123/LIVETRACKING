require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
//const userRoutes = require('./src/route/user.route');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3001; // Use port from environment variable or default to 3000

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' })); // Adjust the limit as needed
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Serve Uploaded Images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create HTTP server for socket.io
const server = http.createServer(app);

// Integrate socket.io






// User Routes
//app.use('/user', userRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Add the trackDriver route


// Start the HTTP server
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});

// Create a WebSocket server
const Driver = require('./src/model/driver.model'); // Import the Driver model

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  ws.on('message', async function incoming(message) {
    try {
      const { phoneNumber } = JSON.parse(message);

      // Fetch driver data from the database based on phoneNumber
      const driver = await Driver.findOne({ phoneNumber });

      // Check if driver data is found
      if (!driver) {
        ws.send(JSON.stringify({ error: 'Driver not found' }));
        return;
      }

      // Extract latitude and longitude from the driver data
      const { latitude, longitude } = driver;

      // Send latitude and longitude back to the client
      ws.send(JSON.stringify({ latitude, longitude }));
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
});



  


