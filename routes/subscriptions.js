// routes/subscriptions.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const stripe = require('../config/stripe-config');
const stripeUtils = require('../utils/stripe-utils');
const User = require('../models/User');

/**
 * @route GET /api/subscriptions/plans
 * @desc Get available subscription plans with monthly and annual options
 * @access Public
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = {
      basic: {
        name: 'Basic',
        description: 'Get started with basic trekking itineraries',
        prices: {
          monthly: {
            id: process.env.STRIPE_BASIC_PLAN_MONTHLY_ID || 'free',
            price: 0,
            interval: 'month',
            display: '$0/month'
          },
          annual: {
            id: process.env.STRIPE_BASIC_PLAN_ANNUAL_ID || 'free',
            price: 0,
            interval: 'year',
            display: '$0/year'
          }
        },
        features: [
          'Generate up to 5 itineraries per month',
          'Save up to 3 itineraries',
          'Advanced filters and preferences',
          'Re-generate itinerary with feedback or changes',
          'Basic conversational planning'
        ]
      },
      pro: {
        name: 'Professional',
        description: 'Unlock unlimited itineraries and premium features',
        prices: {
          monthly: {
            id: process.env.STRIPE_PRO_PLAN_MONTHLY_ID,
            price: 9.99,
            interval: 'month',
            display: '$9.99/month'
          },
          annual: {
            id: process.env.STRIPE_PRO_PLAN_ANNUAL_ID,
            price: 99.99,
            interval: 'year',
            display: '$99.99/year',
            savings: '17%',
            saveAmount: '$19.89'
          }
        },
        features: [
          'Unlimited itinerary generation',
          'Unlimited saved itineraries',
          'Advanced filters and preferences',
          'Re-generate itinerary with feedback or changes',
          'Advanced conversational planning',
          'Access to early features',
        ]
      }
    };
    
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/subscriptions/create-checkout-session
 * @desc Create Stripe checkout session for subscription
 * @access Private
 */
router.post('/create-checkout-session', verifyToken, async (req, res) => {
  try {
    const { priceId, billingInterval = 'monthly' } = req.body;
    
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }
    
    // Get the domain from request for success/cancel URLs
    const origin = req.get('origin') || 'https://smarttrails.pro';
    
    // Find user to check if they already have a subscription
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user doesn't have a Stripe customer ID, create one
    if (!user.subscription.stripeCustomerId) {
      const customer = await stripeUtils.createCustomer(user);
      user.subscription.stripeCustomerId = customer.id;
      await user.save();
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: user.subscription.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscription/cancel`,
      metadata: {
        userId: req.user.userId.toString(),
        billingInterval: billingInterval
      },
      allow_promotion_codes: true
    });
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * @route POST /api/subscriptions/webhook
 * @desc Webhook handler for Stripe events - handles its own raw body parsing
 * @access Public (secured by Stripe signature verification)
 */
router.post('/webhook', (req, res, next) => {
  // Only apply raw body parsing for this specific route
  if (req.get('Content-Type') === 'application/json' && req.get('stripe-signature')) {
    express.raw({ type: 'application/json' })(req, res, async () => {
      const sig = req.headers['stripe-signature'];
      let event;
      
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
      
      // Handle the event
      try {
        let subscription;
        let status;
        let billingInterval;
        
        switch (event.type) {
          case 'checkout.session.completed':
            const session = event.data.object;
            
            if (session.mode !== 'subscription') {
              return res.json({ received: true, message: 'Non-subscription session, ignoring' });
            }
            
            // Retrieve the subscription details from the session
            subscription = await stripe.subscriptions.retrieve(session.subscription);
            
            // Get billing interval from the subscription items
            billingInterval = subscription.items.data[0].plan.interval;
            
            // Update database using metadata from the session
            await User.findByIdAndUpdate(session.metadata.userId, { 
              $set: { 
                'subscription.status': 'premium',
                'subscription.stripeSubscriptionId': subscription.id,
                'subscription.billingInterval': billingInterval,
                'subscription.startDate': new Date(subscription.current_period_start * 1000),
                'subscription.endDate': new Date(subscription.current_period_end * 1000)
              } 
            });
            
            break;
            
          case 'customer.subscription.updated':
            subscription = event.data.object;
            
            // Check if there's an active/trialing subscription
            status = subscription.status === 'active' || subscription.status === 'trialing' 
              ? 'premium' 
              : 'free';
            
            // Get billing interval
            billingInterval = subscription.items.data[0].plan.interval;
            
            // Find user by subscription ID
            const updatedUser = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
            
            if (updatedUser) {
              await User.findByIdAndUpdate(updatedUser._id, { 
                $set: { 
                  'subscription.status': status,
                  'subscription.billingInterval': billingInterval,
                  'subscription.endDate': new Date(subscription.current_period_end * 1000)
                } 
              });
            }
            
            break;
            
          case 'customer.subscription.deleted':
            subscription = event.data.object;
            
            // Find user by subscription ID
            const userToUpdate = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
            
            if (userToUpdate) {
              await User.findByIdAndUpdate(userToUpdate._id, { 
                $set: { 
                  'subscription.status': 'free',
                  'subscription.endDate': new Date()
                },
                $unset: {
                  'subscription.stripeSubscriptionId': 1
                }
              });
            }
            
            break;
        }
        
        res.json({ received: true });
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Failed to process webhook' });
      }
    });
  } else {
    // Not a webhook request, pass to next middleware
    next();
  }
});

/**
 * @route GET /api/subscriptions/current
 * @desc Get current user subscription details
 * @access Private
 */
router.get('/current', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Base subscription details
    let subscriptionDetails = {
      status: user.subscription.status || 'free',
      billingInterval: user.subscription.billingInterval || 'month',
      formattedInterval: user.subscription.billingInterval === 'year' ? 'annually' : 'monthly',
      startDate: user.subscription.startDate,
      endDate: user.subscription.endDate,
      isActive: user.subscription.status === 'premium'
    };
    
    // If there's a Stripe subscription, fetch additional details
    if (user.subscription.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          user.subscription.stripeSubscriptionId
        );
        
        // Add additional details from Stripe
        subscriptionDetails = {
          ...subscriptionDetails,
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          nextInvoice: stripeSubscription.current_period_end 
            ? new Date(stripeSubscription.current_period_end * 1000) 
            : null,
          plan: {
            name: stripeSubscription.items.data[0]?.plan.product ? 'Pro' : 'Basic',
            amount: stripeSubscription.items.data[0]?.plan.amount 
              ? (stripeSubscription.items.data[0].plan.amount / 100).toFixed(2) 
              : 0,
            currency: stripeSubscription.items.data[0]?.plan.currency 
              ? stripeSubscription.items.data[0].plan.currency.toUpperCase() 
              : 'USD'
          }
        };
        
        // Check if we can get the product details
        if (stripeSubscription.items.data[0]?.plan.product) {
          try {
            const product = await stripe.products.retrieve(
              stripeSubscription.items.data[0].plan.product
            );
            subscriptionDetails.plan.name = product.name;
          } catch (productError) {
            console.error('Error fetching product details:', productError);
          }
        }
      } catch (stripeError) {
        console.error('Error fetching subscription from Stripe:', stripeError);
        // Continue with basic details if Stripe fetch fails
      }
    }
    
    res.json(subscriptionDetails);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/subscriptions/cancel
 * @desc Cancel subscription at period end
 * @access Private
 */
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.subscription.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    
    // Cancel at period end instead of immediately
    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });
    
    res.json({ 
      message: 'Subscription will be canceled at the end of the billing period',
      endDate: user.subscription.endDate
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * @route POST /api/subscriptions/reactivate
 * @desc Reactivate a subscription that was set to cancel at period end
 * @access Private
 */
router.post('/reactivate', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.subscription.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }
    
    // Get current subscription
    const currentSubscription = await stripe.subscriptions.retrieve(
      user.subscription.stripeSubscriptionId
    );
    
    if (!currentSubscription.cancel_at_period_end) {
      return res.status(400).json({ error: 'Subscription is not set to cancel' });
    }
    
    // Remove the cancellation
    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });
    
    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

/**
 * @route POST /api/subscriptions/change-plan
 * @desc Change subscription plan (monthly<->annual or basic<->pro)
 * @access Private
 */
router.post('/change-plan', verifyToken, async (req, res) => {
  try {
    const { newPriceId } = req.body;
    
    if (!newPriceId) {
      return res.status(400).json({ error: 'New price ID is required' });
    }
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If no current subscription, create a new checkout session
    if (!user.subscription.stripeSubscriptionId) {
      // Get the domain from request
      const origin = req.get('origin') || 'https://smarttrails.pro';
      
      const session = await stripe.checkout.sessions.create({
        customer: user.subscription.stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [{ price: newPriceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscription/cancel`,
        metadata: {
          userId: user._id.toString()
        }
      });
      
      return res.json({ sessionId: session.id, url: session.url });
    }
    
    // Update existing subscription
    const updatedSubscription = await stripe.subscriptions.retrieve(
      user.subscription.stripeSubscriptionId
    );
    
    // First get the subscription item ID
    const subscriptionItemId = updatedSubscription.items.data[0].id;
    
    // Update the subscription with the new price
    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      items: [{ id: subscriptionItemId, price: newPriceId }],
      proration_behavior: 'create_prorations'
    });
    
    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    res.status(500).json({ error: 'Failed to change subscription plan' });
  }
});

/**
 * @route POST /api/subscriptions/cancel-immediately
 * @desc Immediately cancel subscription (admin/testing only)
 * @access Private
 */
router.post('/cancel-immediately', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.subscription.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    
    // Cancel immediately
    await stripe.subscriptions.del(user.subscription.stripeSubscriptionId);
    
    // Update user record
    user.subscription.status = 'free';
    user.subscription.stripeSubscriptionId = null;
    user.subscription.endDate = new Date();
    await user.save();
    
    res.json({ message: 'Subscription has been canceled immediately' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * @route GET /api/subscriptions/customer-portal
 * @desc Create a customer portal session for subscription management
 * @access Private
 */
router.get('/customer-portal', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.subscription.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }
    
    // Get return URL
    const returnUrl = req.query.returnUrl || 'https://smarttrails.pro/account';
    
    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: returnUrl
    });
    
    res.json({ url: portalSession.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
});

module.exports = router;