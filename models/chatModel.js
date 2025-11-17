import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],
    chatType: {
        type: String,
        enum: ["car", "support"],
        default: "car"
    },
    subject: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["open", "resolved", "closed"],
        default: "open"
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high", "urgent"],
        default: "medium"
    },
    car: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Car",
        default: null
    },
    lastMessage: {
        type: String,
        default: ""
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    },
    isActive: {
        type: Boolean,
        default: true
    },
    reported: {
        type: Boolean,
        default: false
    },
    reportedReason: {
        type: String,
        default: null
    },
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, {
    timestamps: true
});

chatSchema.index({ participants: 1 });
chatSchema.index({ chatType: 1, status: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ reported: 1 });

const Chat = mongoose.model("Chat", chatSchema);

const messageSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        required: true
    },
    messageType: {
        type: String,
        enum: ["text", "image", "file", "system"],
        default: "text"
    },
    attachments: [{
        type: String
    }],
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    isBot: {
        type: Boolean,
        default: false
    },
    seenBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

const Message = mongoose.model("Message", messageSchema);

export { Chat, Message };

