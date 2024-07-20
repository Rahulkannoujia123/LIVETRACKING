const mongoose = require('mongoose');

const salesmanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, // Assuming userId refers to ObjectId of User model
    required: true
  },
  location: {
    type: String,
    required: true
  },
  image: {
    type: String // Assuming image is optional
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Salesman', salesmanSchema);
