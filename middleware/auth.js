// middleware/auth.js
const admin = require('../config/firebase-config');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Middleware to verify Firebase token and attach user to the request
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the token
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      if (!decodedToken) {
        return res.status(401).json({ error: 'Unauthorized - Invalid token' });
      }
      
      // Check MongoDB connection before accessing database
      if (mongoose.connection.readyState !== 1) {
        // If database is not connected, still allow the user to access API
        // by setting basic user information from the token
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          userId: decodedToken.uid, // Use Firebase UID as fallback
          subscription: 'free'      // Default to free tier
        };
        
        console.warn(`Auth middleware - DB unavailable, using token data for user ${decodedToken.email}`);
        return next();
      }
      
      // If MongoDB is connected, proceed with normal flow
      // Check if the user exists in our database
      let user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      // If user doesn't exist, create a new one
      if (!user) {
        // Get user details from Firebase
        const firebaseUser = await admin.auth().getUser(decodedToken.uid);
        
        user = new User({
          firebaseUid: decodedToken.uid,
          email: firebaseUser.email || decodedToken.email,
          firstName: firebaseUser.displayName ? firebaseUser.displayName.split(' ')[0] : '',
          lastName: firebaseUser.displayName ? firebaseUser.displayName.split(' ').slice(1).join(' ') : '',
          subscription: {
            status: 'free',
            startDate: new Date(),
          },
          createdAt: new Date(),
          lastLogin: new Date()
        });
        
        await user.save();
      } else {
        // Update last login
        user.lastLogin = new Date();
        await user.save();
      }
      
      // Attach user info to the request object
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        userId: user._id,
        subscription: user.subscription.status
      };
      
      next();
    } catch (tokenError) {
      console.error('Token verification error:', tokenError);
      return res.status(401).json({ 
        error: 'Unauthorized - Token verification failed', 
        message: tokenError.message 
      });
    }
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ 
      error: 'Unauthorized - Token verification failed',
      message: error.message
    });
  }
};

/**
 * Optional authentication middleware - allows both authenticated and unauthenticated users
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      if (!decodedToken) {
        req.user = null;
        return next();
      }
      
      // Check MongoDB connection
      if (mongoose.connection.readyState !== 1) {
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          userId: decodedToken.uid,
          subscription: 'free'
        };
        console.warn(`Optional auth middleware - DB unavailable, using token data for user ${decodedToken.email}`);
        return next();
      }
      
      // Find or create user in database
      let user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      if (!user) {
        const firebaseUser = await admin.auth().getUser(decodedToken.uid);
        
        user = new User({
          firebaseUid: decodedToken.uid,
          email: firebaseUser.email || decodedToken.email,
          firstName: firebaseUser.displayName ? firebaseUser.displayName.split(' ')[0] : '',
          lastName: firebaseUser.displayName ? firebaseUser.displayName.split(' ').slice(1).join(' ') : '',
          subscription: {
            status: 'free',
            startDate: new Date(),
          },
          createdAt: new Date(),
          lastLogin: new Date()
        });
        
        await user.save();
      } else {
        user.lastLogin = new Date();
        await user.save();
      }
      
      // Set user info
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        userId: user._id,
        subscription: user.subscription.status
      };
      
      next();
    } catch (tokenError) {
      console.error('Optional auth - token verification failed:', tokenError);
      // Continue without authentication instead of failing
      req.user = null;
      next();
    }
  } catch (error) {
    console.error('Optional Auth Middleware Error:', error);
    // Continue without authentication
    req.user = null;
    next();
  }
};

/**
 * Middleware to check for premium subscription
 */
exports.checkPremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized - No user found' });
  }
  
  if (req.user.subscription !== 'premium') {
    return res.status(403).json({ error: 'Subscription required - This feature requires a premium subscription' });
  }
  
  next();
};