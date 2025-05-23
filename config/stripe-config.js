// config/stripe-config.js
const stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
  process.exit(1);
}

module.exports = stripe(process.env.STRIPE_SECRET_KEY);