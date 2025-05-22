// config/firebase-config.js
const admin = require('firebase-admin');

let app;

// Helper function to properly format private key
function formatPrivateKey(privateKey) {
  if (!privateKey) return null;
  
  // Remove any extra quotes that might have been added
  let key = privateKey.replace(/^["'](.*)["']$/, '$1');
  
  // Handle different newline formats
  key = key.replace(/\\n/g, '\n');
  
  // Ensure proper PEM format
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    console.error('❌ Private key does not appear to be in PEM format');
    return null;
  }
  
  // Clean up any extra whitespace but preserve the structure
  const lines = key.split('\n');
  const cleanLines = lines.map(line => line.trim());
  
  return cleanLines.join('\n');
}

try {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length === 0) {
    // Production/Staging: Use environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      console.log('🔥 Initializing Firebase with environment variables...');
      
      // Format the private key properly
      const formattedPrivateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      
      if (!formattedPrivateKey) {
        throw new Error('Invalid private key format');
      }
      
      const firebaseConfig = {
        type: process.env.FIREBASE_TYPE || 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: formattedPrivateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      // Debug: Log the structure without sensitive data
      console.log('🔍 Firebase config structure:', {
        project_id: firebaseConfig.project_id,
        client_email: firebaseConfig.client_email,
        private_key_length: firebaseConfig.private_key ? firebaseConfig.private_key.length : 0,
        private_key_starts_with: firebaseConfig.private_key ? firebaseConfig.private_key.substring(0, 30) + '...' : 'null'
      });

      app = admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        projectId: process.env.FIREBASE_PROJECT_ID
      });

      console.log('✅ Firebase Admin initialized with environment variables');
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
        console.error('❌ Firebase service account file not found and environment variables not set');
        console.error('Please either:');
        console.error('1. Set Firebase environment variables, or');
        console.error('2. Add firebase-service-account.json file for local development');
        
        // Log what env vars are available for debugging
        console.log('🔍 Available Firebase env vars:');
        console.log('- FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);
        console.log('- FIREBASE_PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY ? 'present' : 'missing');
        console.log('- FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
        
        throw new Error('Firebase configuration missing');
      }
    }
  } else {
    app = admin.app();
    console.log('✅ Firebase Admin already initialized');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  
  // More detailed error information
  if (error.message.includes('private key')) {
    console.error('🔧 Private key troubleshooting:');
    console.error('1. Ensure the private key starts with -----BEGIN PRIVATE KEY-----');
    console.error('2. Ensure the private key ends with -----END PRIVATE KEY-----');
    console.error('3. In Render, paste the key with actual line breaks, not \\n');
    console.error('4. Do not add extra quotes around the key in Render');
  }
  
  throw error;
}

module.exports = admin;