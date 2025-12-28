/**
 * Seed example subscription plans (Premium / Dealer) for future use.
 *
 * Usage:
 *   node server/scripts/seedSubscriptionPlans.js
 *
 * This is safe to run multiple times; it will upsert the example plans.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import SubscriptionPlan from "../models/subscriptionPlanModel.js";

dotenv.config();

const examplePlans = [
  {
    name: "premium",
    displayName: "Premium",
    price: 59.99,
    duration: 30,
    features: [
      "Unlimited listings",
      "Priority support",
      "20 boost credits / month",
      "Featured listing badge",
      "Analytics dashboard",
      "Advanced search filters",
    ],
    maxListings: -1,
    boostCredits: 20,
    isActive: false, // keep OFF by default until you go live
    isDefault: false,
    order: 2,
    description: "Best for active individual sellers.",
    visible: false, // hidden from users until you're ready
    allowedRoles: ["user", "dealer", "all"],
    minUserLevel: 0,
    requiresApproval: false,
  },
  {
    name: "dealer",
    displayName: "Dealer",
    price: 149.99,
    duration: 30,
    features: [
      "Unlimited listings",
      "24/7 priority support",
      "50 boost credits / month",
      "Dealer verification badge",
      "Analytics dashboard",
      "Team / multi-user support",
    ],
    maxListings: -1,
    boostCredits: 50,
    isActive: false, // keep OFF by default
    isDefault: false,
    order: 3,
    description: "Ideal for professional dealers and showrooms.",
    visible: false, // hidden until launch
    allowedRoles: ["dealer", "admin"],
    minUserLevel: 0,
    requiresApproval: true, // dealer plans may require manual approval
  },
];

const seedPlans = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not set in environment variables.");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for subscription plan seed");

    for (const plan of examplePlans) {
      const existing = await SubscriptionPlan.findOne({ name: plan.name });
      if (existing) {
        await SubscriptionPlan.updateOne({ _id: existing._id }, plan);
        console.log(`🔁 Updated existing plan: ${plan.name}`);
      } else {
        await SubscriptionPlan.create(plan);
        console.log(`✨ Created plan: ${plan.name}`);
      }
    }

    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding subscription plans:", error);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

seedPlans();


