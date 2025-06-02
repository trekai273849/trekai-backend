// models/Itinerary.js
const mongoose = require('mongoose');

const ItinerarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  filters: {
    accommodation: String,
    difficulty: String,
    technical: String,
    altitude: String
  },
  comments: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  // NEW FIELDS FOR POPULAR TREKS
  type: {
    type: String,
    enum: ['custom', 'popular-trek'],
    default: 'custom'
  },
  trekId: {
    type: String,  // Reference to the popular trek ID
    sparse: true  // Allow null for custom itineraries
  },
  trekDetails: {
    country: String,
    region: String,
    maxElevation: Number,
    distance: Number,
    summary: String,
    duration: Number
  },
  // END NEW FIELDS
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastViewed: {
    type: Date,
    default: Date.now
  }
});

// Add compound index to prevent duplicate saves of same trek by same user
ItinerarySchema.index({ user: 1, trekId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Itinerary', ItinerarySchema);