// routes/itineraries.js
const express = require('express');
const router = express.Router();
const Itinerary = require('../models/Itinerary');

// Get all itineraries for a user
router.get('/', async (req, res) => {
  try {
    // Now getting userId from auth middleware
    const userId = req.user.userId;
    
    const itineraries = await Itinerary.find({ user: userId })
      .sort({ createdAt: -1 });
      
    res.json(itineraries);
  } catch (error) {
    console.error('Error fetching itineraries:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single itinerary by ID
router.get('/:id', async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Save a new itinerary
router.post('/', async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Update an itinerary
router.put('/:id', async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an itinerary
router.delete('/:id', async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;