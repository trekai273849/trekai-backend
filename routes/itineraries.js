// routes/itineraries.js
const express = require('express');
const router = express.Router();
const Itinerary = require('../models/Itinerary');

// Get all itineraries for a user
router.get('/', async (req, res) => {
  try {
    // In a real app, you would get userId from auth middleware
    // This is a placeholder - replace with actual auth logic
    const userId = req.query.userId; 
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
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
    const { userId, title, location, filters, comments, content } = req.body;
    
    if (!userId || !title || !location || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newItinerary = new Itinerary({
      user: userId,
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
    const updates = req.body;
    const itinerary = await Itinerary.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    res.json(itinerary);
  } catch (error) {
    console.error('Error updating itinerary:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an itinerary
router.delete('/:id', async (req, res) => {
  try {
    const itinerary = await Itinerary.findByIdAndDelete(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    res.json({ message: 'Itinerary deleted successfully' });
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;