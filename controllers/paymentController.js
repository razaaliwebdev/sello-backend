import Stripe from 'stripe';
import User from '../models/userModel.js';
import Logger from '../utils/logger.js';
import { SUBSCRIPTION_PLANS } from './subscriptionController.js';

// Initialize Stripe only if key is provided
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    try {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2024-12-18.acacia',
        });
        Logger.info('Stripe initialized successfully');
    } catch (error) {
        Logger.warn('Failed to initialize Stripe:', error.message);
    }
} else {
    Logger.warn('STRIPE_SECRET_KEY not set. Payment features will be disabled.');
}

/**
 * Create Stripe Checkout Session for Subscription
 */
export const createSubscriptionCheckout = async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({
                success: false,
                message: 'Payment service is not configured. Please set STRIPE_SECRET_KEY in environment variables.'
            });
        }

        const { plan, autoRenew = true } = req.body;

        if (!plan || !SUBSCRIPTION_PLANS[plan]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription plan'
            });
        }

        const selectedPlan = SUBSCRIPTION_PLANS[plan];
        const user = await User.findById(req.user._id);

        // Check if user already has an active subscription
        if (user.subscription.isActive && user.subscription.plan === plan) {
            return res.status(400).json({
                success: false,
                message: `You already have an active ${plan} subscription`
            });
        }

        // Validate CLIENT_URL
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        if (!clientUrl || clientUrl.includes('meet.google.com') || clientUrl.includes('google.com/meet')) {
            Logger.error('Invalid CLIENT_URL detected:', clientUrl);
            return res.status(500).json({
                success: false,
                message: 'Server configuration error: Invalid CLIENT_URL. Please set CLIENT_URL to your frontend URL (e.g., http://localhost:5173)'
            });
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${selectedPlan.name} Subscription`,
                            description: selectedPlan.features.join(', ')
                        },
                        unit_amount: Math.round(selectedPlan.price * 100), // Convert to cents
                        recurring: autoRenew ? {
                            interval: 'month'
                        } : undefined
                    },
                    quantity: 1,
                },
            ],
            mode: autoRenew ? 'subscription' : 'payment',
            success_url: `${clientUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientUrl}/profile`,
            customer_email: user.email,
            metadata: {
                userId: user._id.toString(),
                plan: plan,
                autoRenew: autoRenew.toString()
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url
            }
        });
    } catch (error) {
        Logger.error('Create Subscription Checkout Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating checkout session',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create Stripe Checkout Session for Boost
 */
export const createBoostCheckout = async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({
                success: false,
                message: 'Payment service is not configured. Please set STRIPE_SECRET_KEY in environment variables.'
            });
        }

        const { carId, duration = 7 } = req.body;

        if (!carId) {
            return res.status(400).json({
                success: false,
                message: 'Car ID is required'
            });
        }

        // Validate CLIENT_URL
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        if (!clientUrl || clientUrl.includes('meet.google.com') || clientUrl.includes('google.com/meet')) {
            Logger.error('Invalid CLIENT_URL detected:', clientUrl);
            return res.status(500).json({
                success: false,
                message: 'Server configuration error: Invalid CLIENT_URL. Please set CLIENT_URL to your frontend URL (e.g., http://localhost:5173)'
            });
        }

        const boostCost = 5 * duration; // $5 per day

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Boost Post for ${duration} days`,
                            description: `Promote your car listing to the top for ${duration} days`
                        },
                        unit_amount: Math.round(boostCost * 100), // Convert to cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${clientUrl}/boost/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientUrl}/my-listings`,
            customer_email: req.user.email,
            metadata: {
                userId: req.user._id.toString(),
                carId: carId,
                duration: duration.toString(),
                purpose: 'boost'
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url
            }
        });
    } catch (error) {
        Logger.error('Create Boost Checkout Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating checkout session',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Stripe Webhook Handler
 */
export const stripeWebhook = async (req, res) => {
    if (!stripe) {
        Logger.warn('Stripe webhook received but Stripe is not configured');
        return res.status(503).json({ error: 'Payment service not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        Logger.warn('STRIPE_WEBHOOK_SECRET not set');
        return res.status(503).json({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        Logger.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                await handleCheckoutCompleted(session);
                break;

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                const subscription = event.data.object;
                await handleSubscriptionUpdate(subscription);
                break;

            case 'customer.subscription.deleted':
                const deletedSubscription = event.data.object;
                await handleSubscriptionDeleted(deletedSubscription);
                break;

            default:
                Logger.info(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        Logger.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
};

/**
 * Handle Checkout Completed
 */
async function handleCheckoutCompleted(session) {
    try {
        const { userId, plan, carId, duration, purpose } = session.metadata;

        if (purpose === 'boost') {
            // Handle boost payment
            const Car = (await import('../models/carModel.js')).default;
            const car = await Car.findById(carId);
            
            if (car) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + parseInt(duration));

                car.isBoosted = true;
                car.boostExpiry = expiryDate;
                car.boostPriority = 50;
                car.boostHistory.push({
                    boostedAt: new Date(),
                    boostedBy: userId,
                    boostType: 'user',
                    duration: parseInt(duration),
                    expiredAt: expiryDate
                });

                await car.save();
                Logger.info(`Car ${carId} boosted via Stripe payment`);
            }
        } else if (plan) {
            // Handle subscription payment
            const user = await User.findById(userId);
            if (user) {
                const selectedPlan = SUBSCRIPTION_PLANS[plan];
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + selectedPlan.duration);

                user.subscription = {
                    plan: plan,
                    startDate: startDate,
                    endDate: endDate,
                    isActive: true,
                    autoRenew: session.metadata.autoRenew === 'true'
                };

                if (selectedPlan.boostCredits > 0) {
                    user.boostCredits += selectedPlan.boostCredits;
                }

                user.paymentHistory.push({
                    amount: selectedPlan.price,
                    currency: 'USD',
                    paymentMethod: 'stripe',
                    transactionId: session.id,
                    purpose: 'subscription',
                    status: 'completed',
                    createdAt: new Date()
                });

                user.totalSpent += selectedPlan.price;
                await user.save();
                Logger.info(`User ${userId} subscribed to ${plan} plan via Stripe`);
            }
        }
    } catch (error) {
        Logger.error('Handle checkout completed error:', error);
    }
}

/**
 * Handle Subscription Update
 */
async function handleSubscriptionUpdate(subscription) {
    try {
        // Find user by customer ID or subscription metadata
        // This would need to be stored when creating the subscription
        Logger.info('Subscription updated:', subscription.id);
    } catch (error) {
        Logger.error('Handle subscription update error:', error);
    }
}

/**
 * Handle Subscription Deleted
 */
async function handleSubscriptionDeleted(subscription) {
    try {
        // Find user and cancel their subscription
        Logger.info('Subscription deleted:', subscription.id);
    } catch (error) {
        Logger.error('Handle subscription deleted error:', error);
    }
}

