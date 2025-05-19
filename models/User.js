// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: false, // No longer required with Firebase auth
    minlength: [6, 'Password must be at least 6 characters long']
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  subscription: {
    status: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  preferences: {
    darkMode: {
      type: Boolean,
      default: false
    },
    defaultDifficulty: {
      type: String,
      enum: ['easy', 'moderate', 'challenging', ''],
      default: ''
    },
    defaultAccommodation: {
      type: String,
      enum: ['camping', 'hostel', 'hotel', 'guesthouse', ''],
      default: ''
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date
});

module.exports = mongoose.model('User', UserSchema);