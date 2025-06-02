// config/firebase-config.js
const admin = require('firebase-admin');

let app;

// Helper function to properly format private key
function formatPrivateKey(privateKey) {
  if (!privateKey) return null;
  
  // Remove any surrounding quotes
  let key = privateKey.trim().replace(/^["']|["']$/g, '');
  
  // Handle escaped newlines (common in environment variables)
  key = key.replace(/\\n/g, '\n');
  
  // Ensure proper PEM format
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    console.error('❌ Private key does not appear to be in PEM format');
    console.error('Key starts with:', key.substring(0, 50));
    return null;
  }
  
  if (!key.includes('-----END PRIVATE KEY-----')) {
    console.error('❌ Private key appears to be truncated');
    return null;
  }
  
  // Ensure there are line breaks after the header and before the footer
  key = key.replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n');
  key = key.replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');
  
  // Remove any duplicate newlines
  key = key.replace(/\n\n+/g, '\n');
  
  return key;
}

try {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length === 0) {
    // Production/Staging: Use environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      console.log('🔥 Initializing Firebase with environment variables...');
      console.log('📋 Project ID:', process.env.FIREBASE_PROJECT_ID);
      
      // Format the private key properly
      const formattedPrivateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      
      if (!formattedPrivateKey) {
        console.error('❌ Failed to format private key');
        console.error('Raw key length:', process.env.FIREBASE_PRIVATE_KEY?.length || 0);
        throw new Error('Invalid private key format');
      }
      
      const firebaseConfig = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: formattedPrivateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      // Validate required fields
      const requiredFields = ['project_id', 'private_key', 'client_email'];
      for (const field of requiredFields) {
        if (!firebaseConfig[field]) {
          console.error(`❌ Missing required field: ${field}`);
          throw new Error(`Missing required Firebase config: ${field}`);
        }
      }

      // Debug: Log config structure (without sensitive data)
      console.log('🔍 Firebase config validation:', {
        has_project_id: !!firebaseConfig.project_id,
        has_private_key: !!firebaseConfig.private_key,
        has_client_email: !!firebaseConfig.client_email,
        private_key_format_valid: firebaseConfig.private_key.includes('BEGIN PRIVATE KEY'),
        private_key_length: firebaseConfig.private_key.length
      });

      // Initialize with better error handling
      try {
        app = admin.initializeApp({
          credential: admin.credential.cert(firebaseConfig),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        
        console.log('✅ Firebase Admin initialized successfully');
        
        // Test the initialization by trying to verify a dummy token
        // This will fail but will confirm the SDK is working
        admin.auth().verifyIdToken('dummy').catch(() => {
          console.log('✅ Firebase Admin SDK is responding correctly');
        });
        
      } catch (initError) {
        console.error('❌ Firebase initialization failed:', initError.message);
        if (initError.message.includes('private_key')) {
          console.error('🔧 This is likely a private key formatting issue');
          console.error('Please ensure the private key in your environment:');
          console.error('1. Starts with -----BEGIN PRIVATE KEY-----');
          console.error('2. Ends with -----END PRIVATE KEY-----');
          console.error('3. Has actual line breaks (not \\n)');
          console.error('4. Is not wrapped in quotes');
        }
        throw initError;
      }
    } 
    // Development: Try to use JSON file (fallback)
    else {
      try {
        console.log('🔍 Trying to load Firebase service account file...');
        const serviceAccount = require('../firebase-service-account.json');
        app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log('✅ Firebase Admin initialized with service account file');
      } catch (fileError) {
        console.error('❌ Firebase configuration missing');
        console.error('Please either:');
        console.error('1. Set all required Firebase environment variables:');
        console.error('   - FIREBASE_PROJECT_ID');
        console.error('   - FIREBASE_PRIVATE_KEY');
        console.error('   - FIREBASE_CLIENT_EMAIL');
        console.error('2. Add firebase-service-account.json for local development');
        throw new Error('Firebase configuration missing');
      }
    }
  } else {
    app = admin.app();
    console.log('✅ Firebase Admin already initialized');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  console.error('Stack:', error.stack);
  
  // Don't throw in production - let the server start but log the error
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️  Firebase Admin SDK failed to initialize');
    console.error('Authentication will not work until this is fixed');
  } else {
    throw error;
  }
}

module.exports = admin;