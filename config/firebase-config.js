// config/firebase-config.js
const admin = require('firebase-admin');

let app;

try {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length === 0) {
    // Production/Staging: Use environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      const firebaseConfig = {
        type: process.env.FIREBASE_TYPE || 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      app = admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        projectId: process.env.FIREBASE_PROJECT_ID
      });

      console.log('✅ Firebase Admin initialized with environment variables');
    } 
    // Development: Try to use JSON file (fallback)
    else {
      try {
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
        throw new Error('Firebase configuration missing');
      }
    }
  } else {
    app = admin.app();
    console.log('✅ Firebase Admin already initialized');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}

module.exports = admin;