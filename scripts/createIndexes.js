import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const createIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;

    // Cars Collection Indexes
    console.log("🔧 Creating indexes for cars collection...");

    // Compound index for user's cars with status and date
    await db
      .collection("cars")
      .createIndex(
        { postedBy: 1, status: 1, createdAt: -1 },
        { name: "idx_user_status_date" }
      );

    // Search and filter indexes
    await db
      .collection("cars")
      .createIndex(
        { make: 1, model: 1, year: 1, price: 1 },
        { name: "idx_search_filters" }
      );

    // Location index for geospatial queries
    await db
      .collection("cars")
      .createIndex({ location: "2dsphere" }, { name: "idx_location" });

    // Text search index
    await db.collection("cars").createIndex(
      {
        title: "text",
        description: "text",
        make: "text",
        model: "text",
        variant: "text",
      },
      { name: "idx_text_search" }
    );

    // Price range index
    await db
      .collection("cars")
      .createIndex({ price: 1 }, { name: "idx_price" });

    // Status and approval index
    await db
      .collection("cars")
      .createIndex(
        { status: 1, isApproved: 1 },
        { name: "idx_status_approval" }
      );

    // Users Collection Indexes
    console.log("🔧 Creating indexes for users collection...");

    await db
      .collection("users")
      .createIndex({ email: 1 }, { unique: true, name: "idx_email_unique" });

    await db
      .collection("users")
      .createIndex({ status: 1, role: 1 }, { name: "idx_status_role" });

    await db
      .collection("users")
      .createIndex({ phone: 1 }, { sparse: true, name: "idx_phone" });

    // Chats Collection Indexes
    console.log("🔧 Creating indexes for chats collection...");

    await db
      .collection("chats")
      .createIndex(
        { participants: 1, lastMessage: -1 },
        { name: "idx_participants_lastmessage" }
      );

    await db
      .collection("chats")
      .createIndex({ chatType: 1, createdAt: -1 }, { name: "idx_type_date" });

    // Notifications Collection Indexes
    console.log("🔧 Creating indexes for notifications collection...");

    await db
      .collection("notifications")
      .createIndex(
        { userId: 1, read: 1, createdAt: -1 },
        { name: "idx_user_read_date" }
      );

    // Refresh Tokens Collection Indexes
    console.log("🔧 Creating indexes for refresh tokens collection...");

    await db
      .collection("refreshtokens")
      .createIndex({ userId: 1, expiresAt: 1 }, { name: "idx_user_expires" });

    await db
      .collection("refreshtokens")
      .createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
        { name: "idx_auto_expire" }
      );

    // Audit Logs Collection Indexes
    console.log("🔧 Creating indexes for audit logs collection...");

    await db
      .collection("auditlogs")
      .createIndex(
        { userId: 1, action: 1, timestamp: -1 },
        { name: "idx_user_action_timestamp" }
      );

    await db
      .collection("auditlogs")
      .createIndex({ timestamp: -1 }, { name: "idx_timestamp" });

    console.log("✅ All indexes created successfully!");

    // Show index information
    const collections = [
      "cars",
      "users",
      "chats",
      "notifications",
      "refreshtokens",
      "auditlogs",
    ];

    for (const collectionName of collections) {
      try {
        const indexes = await db
          .collection(collectionName)
          .listIndexes()
          .toArray();
        console.log(`\n📊 Indexes for ${collectionName}:`);
        indexes.forEach((index) => {
          console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });
      } catch (error) {
        console.log(`⚠️  Could not list indexes for ${collectionName}`);
      }
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    process.exit(1);
  }
};

// Run the script
createIndexes();
