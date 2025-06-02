// routes/itineraries.js
const express = require('express');
const router = express.Router();
const Itinerary = require('../models/Itinerary');
const mongoose = require('mongoose');

// Get all itineraries for a user
router.get('/', async (req, res) => {
  try {
    // Check if database is connected before proceeding
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        message: 'The database is currently unavailable. Please try again later.'
      });
    }
    
    // Now getting userId from auth middleware
    const userId = req.user.userId;
    
    const itineraries = await Itinerary.find({ user: userId })
      .sort({ createdAt: -1 });
      
    res.json(itineraries);
  } catch (error) {
    console.error('Error fetching itineraries:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Get a single itinerary by ID
router.get('/:id', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        message: 'The database is currently unavailable. Please try again later.'
      });
    }
    
    const itinerary = await Itinerary.findById(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Check if the itinerary belongs to the authenticated user
    if (itinerary.user.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to access this itinerary' });
    }
    
    // Update lastViewed timestamp
    itinerary.lastViewed = Date.now();
    await itinerary.save();
    
    res.json(itinerary);
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Save a new itinerary
router.post('/', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        message: 'The database is currently unavailable. Please try again later.'
      });
    }
    
    const { title, location, filters, comments, content } = req.body;
    
    if (!title || !location || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newItinerary = new Itinerary({
      user: req.user.userId, // Get from auth middleware
      title,
      location,
      filters: filters || {},
      comments,
      content
    });
    
    const savedItinerary = await newItinerary.save();
    res.status(201).json(savedItinerary);
  } catch (error) {
    console.error('Error saving itinerary:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Update an itinerary
router.put('/:id', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        message: 'The database is currently unavailable. Please try again later.'
      });
    }
    
    // First find the itinerary to check ownership
    const itinerary = await Itinerary.findById(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Check ownership
    if (itinerary.user.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this itinerary' });
    }
    
    const updates = req.body;
    const updatedItinerary = await Itinerary.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    
    res.json(updatedItinerary);
  } catch (error) {
    console.error('Error updating itinerary:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Delete an itinerary
router.delete('/:id', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        message: 'The database is currently unavailable. Please try again later.'
      });
    }
    
    // First find the itinerary to check ownership
    const itinerary = await Itinerary.findById(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    // Check ownership
    if (itinerary.user.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this itinerary' });
    }
    
    await Itinerary.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Itinerary deleted successfully' });
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }

// Add this route to routes/itineraries.js

// Check if a trek is already saved
router.get('/check-trek/:trekId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection unavailable'
      });
    }
    
    const { trekId } = req.params;
    const userId = req.user.userId;
    
    const existingItinerary = await Itinerary.findOne({
      user: userId,
      trekId: trekId,
      type: 'popular-trek'
    });
    
    res.json({
      isSaved: !!existingItinerary,
      itineraryId: existingItinerary?._id
    });
    
  } catch (error) {
    console.error('Error checking trek:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update the POST route to handle duplicates better
router.post('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection unavailable'
      });
    }
    
    const { title, location, filters, comments, content, type, trekId, trekDetails } = req.body;
    
    if (!title || !location || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check for duplicate popular trek saves
    if (type === 'popular-trek' && trekId) {
      const existing = await Itinerary.findOne({
        user: req.user.userId,
        trekId: trekId,
        type: 'popular-trek'
      });
      
      if (existing) {
        return res.status(409).json({ 
          error: 'Trek already saved',
          message: 'This trek is already in your saved trips',
          itineraryId: existing._id
        });
      }
    }
    
    const newItinerary = new Itinerary({
      user: req.user.userId,
      title,
      location,
      filters: filters || {},
      comments,
      content,
      type: type || 'custom',
      trekId,
      trekDetails
    });
    
    const savedItinerary = await newItinerary.save();
    res.status(201).json(savedItinerary);
  } catch (error) {
    console.error('Error saving itinerary:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Trek already saved',
        message: 'This trek is already in your saved trips'
      });
    }
    
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

});

module.exports = router;