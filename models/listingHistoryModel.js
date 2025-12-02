import mongoose from "mongoose";

const listingHistorySchema = new mongoose.Schema(
  {
    // Original listing identifier (for audit/debug)
    oldListingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
      index: true,
    },

    // Snapshot of important listing fields (no images)
    title: { type: String, required: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    mileage: { type: Number, default: 0 },

    // Final status information
    finalStatus: {
      type: String,
      enum: ["sold", "expired", "deleted"],
      required: true,
      default: "sold",
      index: true,
    },
    finalSellingDate: {
      type: Date,
      default: null,
      index: true,
    },

    // Who owned / sold the listing
    sellerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Deletion metadata
    isAutoDeleted: {
      type: Boolean,
      default: true,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // usually admin on manual deletes, null for cron
      default: null,
    },
    deletedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

listingHistorySchema.index({ finalStatus: 1, finalSellingDate: -1 });

const ListingHistory = mongoose.model("ListingHistory", listingHistorySchema);

export default ListingHistory;


