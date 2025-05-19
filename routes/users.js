// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken, checkPremium } = require('../middleware/auth');
const admin = require('../config/firebase-config');

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user.userId })
      .select('-__v');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, preferences } = req.body;
    
    // Fields that are allowed to be updated
    const updateFields = {};
    
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (preferences) updateFields.preferences = preferences;
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateFields },
      { new: true }
    ).select('-__v');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If name was updated, also update in Firebase
    if (firstName || lastName) {
      const displayName = `${firstName || user.firstName} ${lastName || user.lastName}`.trim();
      if (displayName) {
        await admin.auth().updateUser(user.firebaseUid, {
          displayName
        });
      }
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get subscription status
router.get('/subscription', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('subscription');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      status: user.subscription.status,
      startDate: user.subscription.startDate,
      endDate: user.subscription.endDate
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user account
router.delete('/account', verifyToken, async (req, res) => {
  try {
    // Delete from MongoDB
    const user = await User.findByIdAndDelete(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete from Firebase
    await admin.auth().deleteUser(user.firebaseUid);
    
    // In a real application, you might want to handle:
    // 1. Deleting the user's data (itineraries, etc.)
    // 2. Cancelling subscriptions
    // 3. Send confirmation email
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to routes/users.js
router.get('/test', verifyToken, (req, res) => {
  res.json({
    message: 'Authentication successful',
    user: req.user
  });
});

module.exports = router;