import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            enum: ["Super Admin", "Marketing Team", "Support Agent", "Blogs/Content Agent", "Custom"]
        },
        displayName: {
            type: String,
            required: true,
            trim: true
        },
        accessLevel: {
            type: String,
            enum: ["FULL", "MEDIUM_HIGH", "MEDIUM"],
            required: true
        },
        purpose: {
            type: String,
            required: true,
            trim: true
        },
        permissions: {
            // User & Role Management
            manageUsers: { type: Boolean, default: false },
            createRoles: { type: Boolean, default: false },
            editRoles: { type: Boolean, default: false },
            deleteRoles: { type: Boolean, default: false },
            inviteUsers: { type: Boolean, default: false },
            resetPasswords: { type: Boolean, default: false },

            // Listings Management
            viewListings: { type: Boolean, default: false },
            approveListings: { type: Boolean, default: false },
            editListings: { type: Boolean, default: false },
            deleteListings: { type: Boolean, default: false },
            featureListings: { type: Boolean, default: false },

            // Dealers Management
            viewDealers: { type: Boolean, default: false },
            approveDealers: { type: Boolean, default: false },
            editDealers: { type: Boolean, default: false },
            manageDealerSubscriptions: { type: Boolean, default: false },
            viewDealerPerformance: { type: Boolean, default: false },

            // Content Management
            manageBlogs: { type: Boolean, default: false },
            publishBlogs: { type: Boolean, default: false },
            moderateComments: { type: Boolean, default: false },
            managePromotions: { type: Boolean, default: false },
            createPushNotifications: { type: Boolean, default: false },
            sendPushNotifications: { type: Boolean, default: false },

            // Support & Communication
            accessChatbot: { type: Boolean, default: false },
            viewChatbotLogs: { type: Boolean, default: false },
            manageSupportTickets: { type: Boolean, default: false },
            respondToInquiries: { type: Boolean, default: false },
            escalateIssues: { type: Boolean, default: false },

            // Platform Settings
            managePlatformSettings: { type: Boolean, default: false },
            manageLogo: { type: Boolean, default: false },
            manageLanguage: { type: Boolean, default: false },
            manageCurrency: { type: Boolean, default: false },
            manageCommission: { type: Boolean, default: false },
            manageIntegrations: { type: Boolean, default: false },

            // Analytics & Reports
            viewAnalytics: { type: Boolean, default: false },
            viewFinancialReports: { type: Boolean, default: false },
            exportReports: { type: Boolean, default: false },

            // Categories & Content
            manageCategories: { type: Boolean, default: false },
            manageCarTypes: { type: Boolean, default: false },
            manageBanners: { type: Boolean, default: false },

            // Audit & Security
            viewAuditLogs: { type: Boolean, default: false },
            viewUserProfiles: { type: Boolean, default: false },
            viewFullUserProfiles: { type: Boolean, default: false },

            // Sensitive Operations
            accessSensitiveAreas: { type: Boolean, default: false }
        },
        restrictions: {
            type: [String],
            default: []
        },
        isPreset: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);

// Indexes
// Note: name already has an index from unique: true
roleSchema.index({ isActive: 1 });
roleSchema.index({ isPreset: 1 });

const Role = mongoose.model("Role", roleSchema);

export default Role;

