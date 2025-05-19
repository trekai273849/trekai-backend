// middleware/auth.js
const admin = require('../config/firebase-config');
const User = require('../models/User');

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
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
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
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ error: 'Unauthorized - Token verification failed' });
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