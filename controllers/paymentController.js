import Stripe from "stripe";
import User from "../models/userModel.js";
import ProcessedWebhook from "../models/processedWebhookModel.js";
import Logger from "../utils/logger.js";
import { SUBSCRIPTION_PLANS } from "./subscriptionController.js";
import {
  createPaymentIntent,
  verifyPayment,
} from "../services/paymentService.js";

// Initialize Stripe only if key is provided
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    });
    Logger.info("Stripe initialized successfully");
  } catch (error) {
    Logger.warn("Failed to initialize Stripe:", error.message);
  }
} else {
  Logger.warn(
    "STRIPE_SECRET_KEY not set. Stripe payment features will be disabled."
  );
}

// Get payment gateway from environment (currently only Stripe is supported in this setup)
const PAYMENT_GATEWAY = (process.env.PAYMENT_GATEWAY || "stripe").toLowerCase();

/**
 * Create Checkout Session for Subscription
 * Supports Stripe payment gateway
 */
export const createSubscriptionCheckout = async (req, res) => {
  try {
    const { plan, autoRenew = true } = req.body;

    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan",
      });
    }

    const selectedPlan = SUBSCRIPTION_PLANS[plan];
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has an active subscription
    if (
      user.subscription &&
      user.subscription.isActive &&
      user.subscription.plan === plan
    ) {
      return res.status(400).json({
        success: false,
        message: `You already have an active ${plan} subscription`,
      });
    }

    // Helper to activate subscription locally without external payment
    const activateSubscriptionLocally = (
      withExpiry = true,
      reason = "local_activation"
    ) => {
      const now = new Date();
      user.subscription = user.subscription || {};
      user.subscription.isActive = true;
      user.subscription.plan = plan;
      user.subscription.startDate = now;

      if (withExpiry && selectedPlan.duration && selectedPlan.duration > 0) {
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + selectedPlan.duration);
        user.subscription.endDate = endDate;
      } else {
        // lifetime / no expiry
        user.subscription.endDate = null;
      }

      user.subscription.autoRenew = !!autoRenew;

      return {
        reason,
        autoRenew: !!autoRenew,
      };
    };

    // If plan is free or price is 0, activate without external payment
    if (!selectedPlan.price || selectedPlan.price <= 0) {
      const { reason, autoRenew: localAutoRenew } = activateSubscriptionLocally(
        false,
        "free_plan"
      );
      await user.save();

      return res.status(200).json({
        success: true,
        message: `${selectedPlan.name} plan activated successfully without payment.`,
        data: {
          plan: plan,
          autoRenew: localAutoRenew,
          paymentRequired: false,
          reason,
        },
      });
    }

    // Validate CLIENT_URL
    const clientUrl =
      process.env.NODE_ENV === "production"
        ? process.env.PRODUCTION_URL ||
          process.env.CLIENT_URL?.split(",")[0]?.trim()
        : process.env.CLIENT_URL?.split(",")[0]?.trim() ||
          "http://localhost:5173";
    if (
      !clientUrl ||
      clientUrl.includes("meet.google.com") ||
      clientUrl.includes("google.com/meet")
    ) {
      Logger.error("Invalid CLIENT_URL detected:", clientUrl);
      return res.status(500).json({
        success: false,
        message:
          "Server configuration error: Invalid CLIENT_URL. Please set CLIENT_URL to your frontend URL (e.g., http://localhost:5173)",
      });
    }

    // Stripe integration (only gateway used in this project)
    if (!stripe) {
      Logger.error(
        "Stripe payment requested but STRIPE_SECRET_KEY is not set."
      );
      return res.status(503).json({
        success: false,
        message:
          "Payment service is not configured. Please set STRIPE_SECRET_KEY in environment variables.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${selectedPlan.name} Subscription`,
              description: selectedPlan.features.join(", "),
            },
            unit_amount: Math.round(selectedPlan.price * 100), // Convert to cents
            recurring: autoRenew
              ? {
                  interval: "month",
                }
              : undefined,
          },
          quantity: 1,
        },
      ],
      mode: autoRenew ? "subscription" : "payment",
      success_url: `${clientUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/profile`,
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        plan: plan,
        autoRenew: autoRenew.toString(),
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
        gateway: "stripe",
      },
    });
  } catch (error) {
    const isProd = process.env.NODE_ENV === "production";
    Logger.error("Create Subscription Checkout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error creating checkout session",
      // Always include details in non-production to help debugging
      error: isProd
        ? undefined
        : error && (error.stack || error.message || String(error)),
    });
  }
};

/**
 * Create Checkout Session for Boost
 * Supports Stripe payment gateway
 */
export const createBoostCheckout = async (req, res) => {
  try {
    const { carId, duration = 7 } = req.body;

    if (!carId) {
      return res.status(400).json({
        success: false,
        message: "Car ID is required",
      });
    }

    // Validate duration
    const validDurations = [3, 7, 14, 30];
    if (!validDurations.includes(duration)) {
      return res.status(400).json({
        success: false,
        message: `Invalid duration. Valid options are: ${validDurations.join(
          ", "
        )} days`,
      });
    }

    // Verify car exists and user owns it
    const Car = (await import("../models/carModel.js")).default;
    const car = await Car.findById(carId);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car listing not found",
      });
    }

    if (
      car.postedBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only boost your own listings",
      });
    }

    // Check if car is sold or deleted
    if (car.status === "sold" || car.status === "deleted") {
      return res.status(400).json({
        success: false,
        message: `Cannot boost a ${car.status} listing`,
      });
    }

    // Validate CLIENT_URL
    const clientUrl =
      process.env.NODE_ENV === "production"
        ? process.env.PRODUCTION_URL ||
          process.env.CLIENT_URL?.split(",")[0]?.trim()
        : process.env.CLIENT_URL?.split(",")[0]?.trim() ||
          "http://localhost:5173";
    if (
      !clientUrl ||
      clientUrl.includes("meet.google.com") ||
      clientUrl.includes("google.com/meet")
    ) {
      Logger.error("Invalid CLIENT_URL detected:", clientUrl);
      return res.status(500).json({
        success: false,
        message:
          "Server configuration error: Invalid CLIENT_URL. Please set CLIENT_URL to your frontend URL (e.g., http://localhost:5173)",
      });
    }

    const boostCost = 5 * duration; // $5 per day

    // Stripe integration (only gateway used in this project)
    if (!stripe) {
      Logger.error(
        "Stripe boost payment requested but STRIPE_SECRET_KEY is not set."
      );
      return res.status(503).json({
        success: false,
        message:
          "Payment service is not configured. Please set STRIPE_SECRET_KEY in environment variables.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Boost Post for ${duration} days`,
              description: `Promote your car listing to the top for ${duration} days`,
            },
            unit_amount: Math.round(boostCost * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clientUrl}/boost/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/my-listings`,
      customer_email: req.user.email,
      metadata: {
        userId: req.user._id.toString(),
        carId: carId,
        duration: duration.toString(),
        purpose: "boost",
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
        gateway: "stripe",
      },
    });
  } catch (error) {
    Logger.error("Create Boost Checkout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating checkout session",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * JazzCash Webhook/Callback Handler
 * NOTE: JazzCash is not used - only Stripe is supported
 * This function is kept for reference but not exported
 */
const jazzcashWebhook = async (req, res) => {
  try {
    const callbackData = req.body;

    // Verify payment using JazzCash verification
    const verification = await verifyPayment(
      callbackData.pp_TxnRefNo || callbackData.pp_TxnRefNo,
      callbackData
    );

    if (!verification.verified) {
      Logger.warn("JazzCash payment verification failed", {
        transactionId: callbackData.pp_TxnRefNo,
        responseCode: callbackData.pp_ResponseCode,
      });
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Extract metadata from callback
    const userId = callbackData.ppmpf_1;
    const purpose = callbackData.ppmpf_2;
    const carId = callbackData.ppmpf_3;
    const duration = callbackData.ppmpf_4;
    const plan = callbackData.ppmpf_5;

    if (!userId) {
      Logger.error("Missing userId in JazzCash callback", { callbackData });
      return res
        .status(400)
        .json({ success: false, message: "Invalid callback data" });
    }

    const user = await User.findById(userId);
    if (!user) {
      Logger.error(`User ${userId} not found for JazzCash payment`);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if payment was already processed (idempotency)
    const existingPayment = user.paymentHistory.find(
      (p) =>
        p.transactionId === callbackData.pp_TxnRefNo && p.status === "completed"
    );

    if (existingPayment) {
      Logger.info(
        `JazzCash payment ${callbackData.pp_TxnRefNo} already processed`
      );
      return res.json({ received: true, duplicate: true });
    }

    // Handle boost payment
    if (purpose === "boost" && carId && duration) {
      const Car = (await import("../models/carModel.js")).default;
      const car = await Car.findById(carId);

      if (car && car.postedBy.toString() === userId.toString()) {
        const boostCost = parseInt(duration) * 5;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(duration));

        car.isBoosted = true;
        car.boostExpiry = expiryDate;
        car.boostPriority = 50;
        car.boostHistory.push({
          boostedAt: new Date(),
          boostedBy: userId,
          boostType: "user",
          duration: parseInt(duration),
          expiredAt: expiryDate,
          paymentMethod: "jazzcash",
          transactionId: callbackData.pp_TxnRefNo,
        });

        user.paymentHistory.push({
          amount: boostCost,
          currency: "PKR",
          paymentMethod: "jazzcash",
          transactionId: callbackData.pp_TxnRefNo,
          purpose: "boost",
          status: "completed",
          createdAt: new Date(),
          metadata: { carId, duration },
        });

        user.totalSpent = (user.totalSpent || 0) + boostCost;
        await Promise.all([car.save(), user.save()]);

        Logger.info(
          `Car ${carId} boosted via JazzCash - Transaction: ${callbackData.pp_TxnRefNo}`
        );
      }
    }
    // Handle subscription payment
    else if (plan) {
      const selectedPlan = SUBSCRIPTION_PLANS[plan];
      if (selectedPlan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + selectedPlan.duration);

        user.subscription = {
          plan: plan,
          startDate: startDate,
          endDate: endDate,
          isActive: true,
          autoRenew: false, // JazzCash doesn't support auto-renewal
        };

        if (selectedPlan.boostCredits > 0) {
          user.boostCredits += selectedPlan.boostCredits;
        }

        user.paymentHistory.push({
          amount: selectedPlan.price,
          currency: "PKR",
          paymentMethod: "jazzcash",
          transactionId: callbackData.pp_TxnRefNo,
          purpose: "subscription",
          status: "completed",
          createdAt: new Date(),
        });

        user.totalSpent += selectedPlan.price;
        await user.save();

        Logger.info(`User ${userId} subscribed to ${plan} plan via JazzCash`);
      }
    }

    return res.json({ received: true, success: true });
  } catch (error) {
    Logger.error("JazzCash webhook handler error:", error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
};

/**
 * Stripe Webhook Handler
 */
export const stripeWebhook = async (req, res) => {
  if (!stripe) {
    Logger.warn("Stripe webhook received but Stripe is not configured");
    return res.status(503).json({ error: "Payment service not configured" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    Logger.warn("STRIPE_WEBHOOK_SECRET not set");
    return res.status(503).json({ error: "Webhook secret not configured" });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    Logger.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Check if this webhook event has already been processed (idempotency)
  try {
    const existingEvent = await ProcessedWebhook.findOne({ eventId: event.id });
    if (existingEvent) {
      Logger.info("Duplicate webhook event ignored", {
        eventId: event.id,
        eventType: event.type,
        previouslyProcessedAt: existingEvent.processedAt,
      });
      return res.json({
        received: true,
        duplicate: true,
        message: "Event already processed",
      });
    }
  } catch (idempotencyCheckError) {
    // If idempotency check fails, log but continue (don't block webhook processing)
    Logger.warn("Failed to check webhook idempotency", {
      error: idempotencyCheckError.message,
      eventId: event.id,
    });
  }

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;

      case "customer.subscription.deleted":
        const deletedSubscription = event.data.object;
        await handleSubscriptionDeleted(deletedSubscription);
        break;

      default:
        Logger.info(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed (idempotency)
    try {
      await ProcessedWebhook.create({
        eventId: event.id,
        eventType: event.type,
        processedAt: new Date(),
        metadata: {
          livemode: event.livemode,
          apiVersion: event.api_version,
        },
      });
    } catch (saveError) {
      // If save fails (e.g., duplicate key), log but don't fail the webhook
      // This handles race conditions where same event arrives simultaneously
      if (saveError.code === 11000) {
        Logger.warn("Webhook event already processed (race condition)", {
          eventId: event.id,
          eventType: event.type,
        });
      } else {
        Logger.error("Failed to save processed webhook event", {
          error: saveError.message,
          eventId: event.id,
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    Logger.error("Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

/**
 * Handle Checkout Completed
 */
async function handleCheckoutCompleted(session) {
  try {
    // Verify payment status - only process if payment is successful
    if (session.payment_status !== "paid") {
      Logger.warn(
        `Checkout session ${session.id} payment status is not paid: ${session.payment_status}`
      );
      return;
    }

    const { userId, plan, carId, duration, purpose } = session.metadata;

    if (!userId) {
      Logger.error("Missing userId in session metadata", {
        sessionId: session.id,
      });
      return;
    }

    if (purpose === "boost") {
      // Handle boost payment
      if (!carId || !duration) {
        Logger.error("Missing carId or duration in boost payment metadata", {
          sessionId: session.id,
          metadata: session.metadata,
        });
        return;
      }

      const Car = (await import("../models/carModel.js")).default;
      const user = await User.findById(userId);

      if (!user) {
        Logger.error(`User ${userId} not found for boost payment`, {
          sessionId: session.id,
        });
        return;
      }

      // Check if payment was already processed (idempotency check)
      const existingPayment = user.paymentHistory.find(
        (p) => p.transactionId === session.id && p.status === "completed"
      );

      if (existingPayment) {
        Logger.info(
          `Boost payment for session ${session.id} already processed`
        );
        return;
      }

      const car = await Car.findById(carId);

      if (!car) {
        Logger.error(`Car ${carId} not found for boost payment`, {
          sessionId: session.id,
          userId,
        });
        // Still record the payment even if car is deleted
        user.paymentHistory.push({
          amount: parseInt(duration) * 5,
          currency: "USD",
          paymentMethod: "stripe",
          transactionId: session.id,
          purpose: "boost",
          status: "completed",
          createdAt: new Date(),
          metadata: { carId, duration, note: "Car not found" },
        });
        await user.save();
        return;
      }

      // Verify car ownership
      if (car.postedBy.toString() !== userId.toString()) {
        Logger.error(
          `User ${userId} does not own car ${carId} for boost payment`,
          { sessionId: session.id }
        );
        // Record payment but don't boost
        user.paymentHistory.push({
          amount: parseInt(duration) * 5,
          currency: "USD",
          paymentMethod: "stripe",
          transactionId: session.id,
          purpose: "boost",
          status: "completed",
          createdAt: new Date(),
          metadata: { carId, duration, note: "Ownership verification failed" },
        });
        await user.save();
        return;
      }

      // Check if car is sold or deleted
      if (car.status === "sold" || car.status === "deleted") {
        Logger.warn(`Cannot boost car ${carId} - status is ${car.status}`, {
          sessionId: session.id,
        });
        // Record payment but don't boost
        user.paymentHistory.push({
          amount: parseInt(duration) * 5,
          currency: "USD",
          paymentMethod: "stripe",
          transactionId: session.id,
          purpose: "boost",
          status: "completed",
          createdAt: new Date(),
          metadata: { carId, duration, note: `Car status is ${car.status}` },
        });
        await user.save();
        return;
      }

      const boostCost = parseInt(duration) * 5;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(duration));

      // Update car boost status
      car.isBoosted = true;
      car.boostExpiry = expiryDate;
      car.boostPriority = 50;
      car.boostHistory.push({
        boostedAt: new Date(),
        boostedBy: userId,
        boostType: "user",
        duration: parseInt(duration),
        expiredAt: expiryDate,
        paymentMethod: "stripe",
        transactionId: session.id,
      });

      // Record payment in user's payment history
      user.paymentHistory.push({
        amount: boostCost,
        currency: "USD",
        paymentMethod: "stripe",
        transactionId: session.id,
        purpose: "boost",
        status: "completed",
        createdAt: new Date(),
        metadata: { carId, duration },
      });

      // Update user's total spent
      user.totalSpent = (user.totalSpent || 0) + boostCost;

      // Save both car and user
      await Promise.all([car.save(), user.save()]);

      Logger.info(
        `Car ${carId} boosted via Stripe payment - Session: ${session.id}, Duration: ${duration} days, Cost: $${boostCost}`
      );
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
          autoRenew: session.metadata.autoRenew === "true",
        };

        if (selectedPlan.boostCredits > 0) {
          user.boostCredits += selectedPlan.boostCredits;
        }

        user.paymentHistory.push({
          amount: selectedPlan.price,
          currency: "USD",
          paymentMethod: "stripe",
          transactionId: session.id,
          purpose: "subscription",
          status: "completed",
          createdAt: new Date(),
        });

        user.totalSpent += selectedPlan.price;
        await user.save();
        Logger.info(`User ${userId} subscribed to ${plan} plan via Stripe`);
      }
    }
  } catch (error) {
    Logger.error("Handle checkout completed error:", error);
  }
}

/**
 * Verify Payment Session Status
 */
export const verifyPaymentSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: "Payment service is not configured",
      });
    }

    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session belongs to the current user
    if (session.metadata?.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "This payment session does not belong to you",
      });
    }

    // Check payment status
    const isPaid = session.payment_status === "paid";
    const carId = session.metadata?.carId;

    // If payment is successful and it's a boost payment, check if car is boosted
    let boostStatus = null;
    if (isPaid && carId && session.metadata?.purpose === "boost") {
      const Car = (await import("../models/carModel.js")).default;
      const car = await Car.findById(carId).select("isBoosted boostExpiry");
      if (car) {
        boostStatus = {
          isBoosted: car.isBoosted,
          boostExpiry: car.boostExpiry,
          isActive:
            car.isBoosted &&
            car.boostExpiry &&
            new Date(car.boostExpiry) > new Date(),
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        isPaid,
        boostStatus,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    Logger.error("Verify Payment Session Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying payment session",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Handle Subscription Update
 */
async function handleSubscriptionUpdate(subscription) {
  try {
    // Find user by customer ID or subscription metadata
    // This would need to be stored when creating the subscription
    Logger.info("Subscription updated:", subscription.id);
  } catch (error) {
    Logger.error("Handle subscription update error:", error);
  }
}

/**
 * Handle Subscription Deleted
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    // Find user and cancel their subscription
    Logger.info("Subscription deleted:", subscription.id);
  } catch (error) {
    Logger.error("Handle subscription deleted error:", error);
  }
}
