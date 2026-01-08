import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerificationCode: {
      type: String,
      default: null,
    },
    phoneVerificationExpiry: {
      type: Date,
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: true,
      minlength: [6, "Password must be at least 6 characters"],
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Identity Verification (ID Card / Documents)
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Seller Reputation
    sellerRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    role: {
      type: String,
      enum: ["individual", "dealer", "admin"],
      default: "individual",
    },
    adminRole: {
      type: String,
      enum: [
        "Super Admin",
        "Moderator",
        "Support Agent",
        "Content Manager",
        "Dealer Manager",
        "Marketing Team",
        "Blogs/Content Agent",
        "Custom",
        null,
      ],
      default: null,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    avatar: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Boost & Subscription Fields
    boostCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    subscription: {
      plan: {
        type: String,
        enum: ["free", "basic", "premium", "dealer"],
        default: "free",
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      isActive: {
        type: Boolean,
        default: false,
      },
      autoRenew: {
        type: Boolean,
        default: false,
      },
    },
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        currency: { type: String, default: "USD" },
        paymentMethod: { type: String },
        transactionId: { type: String },
        purpose: {
          type: String,
          enum: ["boost", "subscription", "credits"],
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "completed", "failed"],
          default: "pending",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Dealer Specific Fields
    dealerInfo: {
      businessName: { type: String, default: null },
      businessLicense: { type: String, default: null },
      businessAddress: { type: String, default: null },
      businessPhone: { type: String, default: null },
      whatsappNumber: { type: String, default: null },
      city: { type: String, default: null },
      area: { type: String, default: null },
      vehicleTypes: { type: String, default: null },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date, default: null },
      // Enhanced dealer fields (PakWheels/Dubizzle style)
      description: { type: String, default: null },
      website: { type: String, default: null },
      socialMedia: {
        facebook: { type: String, default: null },
        instagram: { type: String, default: null },
        twitter: { type: String, default: null },
        linkedin: { type: String, default: null },
      },
      businessHours: {
        monday: {
          open: String,
          close: String,
          closed: { type: Boolean, default: false },
        },
        tuesday: {
          open: String,
          close: String,
          closed: { type: Boolean, default: false },
        },
        wednesday: {
          open: String,
          close: String,
          closed: { type: Boolean, default: false },
        },
        thursday: {
          open: String,
          close: String,
          closed: { type: Boolean, default: false },
        },
        friday: {
          open: String,
          close: String,
          closed: { type: Boolean, default: false },
        },
        saturday: {
          open: String,
          close: String,
          closed: { type: Boolean, default: false },
        },
        sunday: {
          open: String,
          close: String,
          closed: { type: Boolean, default: false },
        },
      },
      locations: [
        {
          name: String,
          address: String,
          city: String,
          area: String,
          phone: String,
          coordinates: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] },
          },
        },
      ],
      specialties: [{ type: String }], // e.g., "Luxury Cars", "Budget Cars", "Electric Vehicles"
      yearsInBusiness: { type: Number, default: null },
      totalCarsSold: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
      showroomImages: [{ type: String }], // Images of the showroom
      certifications: [{ type: String }], // Industry certifications
      languages: [{ type: String }], // Languages spoken
      paymentMethods: [{ type: String }], // Accepted payment methods
      services: [{ type: String }], // Services offered (e.g., "Financing", "Trade-in", "Warranty")
      establishedYear: { type: Number, default: null },
      employeeCount: { type: String, default: null }, // e.g., "1-10", "11-50", "50+"
      monthlyInventory: { type: Number, default: 0 }, // Average cars in inventory
      featured: { type: Boolean, default: false }, // Featured dealer badge
      featuredUntil: { type: Date, default: null },
      subscriptionTier: {
        type: String,
        enum: ["free", "basic", "premium", "dealer"],
        default: "free",
      },
    },
    // 🚗 Cars posted by user (as seller)
    carsPosted: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Car",
      },
    ],
    // 🚗 Cars bought by user (as buyer)
    carsPurchased: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Car",
      },
    ],
    // 💾 Saved/Wishlist cars
    savedCars: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Car",
      },
    ],
    // 🚫 Blocked users (for chat and interactions)
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
// Note: email already has an index from unique: true
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ roleId: 1 }); // Index for role-based user count queries
userSchema.index({ role: 1, status: 1 }); // Compound index for common admin queries
userSchema.index({ "subscription.isActive": 1, "subscription.plan": 1 });
userSchema.index({ "subscription.isActive": 1, "subscription.endDate": 1 }); // For subscription expiration queries

const User = mongoose.model("User", userSchema);

// Static method to find and delete user in one operation
User.findByIdAndDelete = async function (userId) {
  try {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    await this.deleteOne({ _id: userId });
    return user;
  } catch (error) {
    throw error;
  }
};

export default User;
