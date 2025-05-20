// utils/stripe-utils.js
const stripe = require('../config/stripe-config');
const User = require('../models/User');

// Create a Stripe customer
exports.createCustomer = async (user) => {
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    metadata: {
      userId: user._id.toString()
    }
  });
  
  return customer;
};

// Update user subscription in the database
exports.updateUserSubscription = async (userId, data) => {
  const updateData = {
    'subscription.status': data.status
  };
  
  if (data.stripeSubscriptionId) {
    updateData['subscription.stripeSubscriptionId'] = data.stripeSubscriptionId;
  }
  
  if (data.billingInterval) {
    updateData['subscription.billingInterval'] = data.billingInterval;
  }
  
  if (data.startDate) {
    updateData['subscription.startDate'] = data.startDate;
  }
  
  if (data.endDate) {
    updateData['subscription.endDate'] = data.endDate;
  }
  
  await User.findByIdAndUpdate(userId, { $set: updateData });
};