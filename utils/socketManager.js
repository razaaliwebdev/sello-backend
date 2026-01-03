// Socket.io scaling and optimization utilities
import { Server as SocketIOServer } from "socket.io";
import Logger from "./logger.js";

class SocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.rooms = new Map();
    this.messageQueue = [];
  }

  // Initialize Socket.io with memory adapter (no Redis)
  async initialize(server, options = {}) {
    const {
      cors = {
        origin: process.env.CLIENT_URL?.split(",") || ["http://localhost:5173"],
        methods: ["GET", "POST"],
        credentials: true,
      },
      maxConnections = 10000,
      pingTimeout = 60000,
      pingInterval = 25000,
    } = options;

    this.io = new SocketIOServer(server, {
      cors,
      maxHttpBufferSize: 1e6, // 1 MB
      pingTimeout,
      pingInterval,
    });

    // Using memory adapter (no Redis)
    Logger.info("Socket.io server initialized with memory adapter", {
      maxConnections,
      corsOrigins: cors.origin,
    });

    this.setupEventHandlers();
    this.setupHealthChecks();

    return this.io;
  }

  // Get connection statistics
  getStats() {
    return {
      connectedClients: this.connectedClients.size,
      activeRooms: this.rooms.size,
      totalMessages: this.messageQueue.length,
      adapterType: "memory",
    };
  }

  // Graceful shutdown
  async shutdown() {
    Logger.info("Shutting down Socket.io server...");

    // Disconnect all clients
    this.io.emit("server-shutdown", { message: "Server is shutting down" });

    this.io.close();
    Logger.info("Socket.io server shutdown complete");
  }

  // Setup event handlers with proper error handling
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });

    this.io.on("error", (error) => {
      Logger.error("Socket.io server error:", error);
    });
  }

  // Handle new client connection
  handleConnection(socket) {
    const clientId = socket.id;
    const userAgent = socket.handshake.headers["user-agent"];
    const ip = socket.handshake.address;

    // Track client connection
    this.connectedClients.set(clientId, {
      socket,
      connectedAt: new Date(),
      userAgent,
      ip,
      rooms: new Set(),
      userId: null,
    });

    Logger.debug("Client connected", { clientId, ip, userAgent });

    // Setup client event handlers
    this.setupClientHandlers(socket);

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      this.handleDisconnection(clientId, reason);
    });

    // Handle errors
    socket.on("error", (error) => {
      Logger.error("Socket error for client:", clientId, error);
    });
  }

  // Setup client-specific event handlers
  setupClientHandlers(socket) {
    const clientId = socket.id;

    // Join room with validation
    socket.on("join-room", (data) => {
      this.handleJoinRoom(socket, data);
    });

    // Leave room
    socket.on("leave-room", (roomId) => {
      this.handleLeaveRoom(socket, roomId);
    });

    // Send message with validation and rate limiting
    socket.on("send-message", (data) => {
      this.handleMessage(socket, data);
    });

    // Typing indicators
    socket.on("typing-start", (roomId) => {
      socket.to(roomId).emit("typing-start", clientId);
    });

    socket.on("typing-stop", (roomId) => {
      socket.to(roomId).emit("typing-stop", clientId);
    });

    // User authentication
    socket.on("authenticate", (token) => {
      this.handleAuthentication(socket, token);
    });
  }

  // Handle room joining with validation
  handleJoinRoom(socket, data) {
    const { roomId, type = "chat" } = data;
    const clientId = socket.id;

    if (!roomId || typeof roomId !== "string") {
      socket.emit("error", { message: "Invalid room ID" });
      return;
    }

    // Validate room access based on type
    if (!this.validateRoomAccess(socket, roomId, type)) {
      socket.emit("error", { message: "Access denied to room" });
      return;
    }

    socket.join(roomId);

    // Update client tracking
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.rooms.add(roomId);
    }

    // Update room tracking
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(clientId);

    socket.emit("joined-room", { roomId });
    socket.to(roomId).emit("user-joined", { userId: clientId });

    Logger.debug("Client joined room", { clientId, roomId, type });
  }

  // Validate room access based on business rules
  validateRoomAccess(socket, roomId, type) {
    const client = this.connectedClients.get(socket.id);

    switch (type) {
      case "chat":
        // Validate chat room access (user must be participant)
        return this.validateChatRoomAccess(client?.userId, roomId);

      case "support":
        // Support rooms are open to authenticated users
        return !!client?.userId;

      case "admin":
        // Admin rooms require admin role
        return this.validateAdminAccess(client?.userId);

      default:
        return false;
    }
  }

  // Handle message sending with validation and rate limiting
  handleMessage(socket, data) {
    const { roomId, message, type = "text" } = data;
    const clientId = socket.id;

    // Validate message
    if (!this.validateMessage(message, type)) {
      socket.emit("error", { message: "Invalid message format" });
      return;
    }

    // Rate limiting check
    if (this.isRateLimited(clientId)) {
      socket.emit("error", { message: "Rate limit exceeded" });
      return;
    }

    // Process and broadcast message
    const processedMessage = {
      id: this.generateMessageId(),
      senderId: clientId,
      roomId,
      content: message,
      type,
      timestamp: new Date().toISOString(),
      metadata: this.extractMessageMetadata(data),
    };

    // Broadcast to room
    socket.to(roomId).emit("message-received", processedMessage);
    socket.emit("message-sent", processedMessage);

    // Store message for history
    this.storeMessage(processedMessage);

    Logger.debug("Message sent", {
      clientId,
      roomId,
      messageId: processedMessage.id,
    });
  }

  // Validate message format and content
  validateMessage(message, type) {
    if (!message) return false;

    switch (type) {
      case "text":
        return typeof message === "string" && message.length <= 1000;
      case "image":
        return typeof message === "string" && message.startsWith("data:image");
      case "file":
        return typeof message === "object" && message.url && message.name;
      default:
        return false;
    }
  }

  // Simple rate limiting implementation
  isRateLimited(clientId) {
    const client = this.connectedClients.get(clientId);
    if (!client) return true;

    const now = Date.now();
    const messageWindow = 60000; // 1 minute
    const maxMessages = 30; // Max 30 messages per minute

    if (!client.lastMessages) {
      client.lastMessages = [];
    }

    // Clean old messages
    client.lastMessages = client.lastMessages.filter(
      (timestamp) => now - timestamp < messageWindow
    );

    // Check rate limit
    if (client.lastMessages.length >= maxMessages) {
      return true;
    }

    client.lastMessages.push(now);
    return false;
  }

  // Handle client disconnection
  handleDisconnection(clientId, reason) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    for (const roomId of client.rooms) {
      socket.to(roomId).emit("user-left", { userId: clientId });

      const roomClients = this.rooms.get(roomId);
      if (roomClients) {
        roomClients.delete(clientId);

        // Clean up empty rooms
        if (roomClients.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }

    // Remove client tracking
    this.connectedClients.delete(clientId);

    Logger.debug("Client disconnected", { clientId, reason });
  }

  // Health checks and monitoring
  setupHealthChecks() {
    setInterval(() => {
      this.checkConnectionHealth();
    }, 30000); // Every 30 seconds
  }

  checkConnectionHealth() {
    const stats = {
      connectedClients: this.connectedClients.size,
      activeRooms: this.rooms.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };

    Logger.debug("Socket.io health check", stats);

    // Emit health status to admin room
    this.io.to("admin-monitoring").emit("health-status", stats);
  }

  // Utility methods
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  extractMessageMetadata(data) {
    const { metadata = {} } = data;
    return {
      userAgent: metadata.userAgent,
      platform: metadata.platform,
      ...metadata,
    };
  }

  // Get connection statistics
  getStats() {
    return {
      connectedClients: this.connectedClients.size,
      activeRooms: this.rooms.size,
      totalMessages: this.messageQueue.length,
      adapterType: this.redisAdapter ? "redis" : "memory",
    };
  }

  // Graceful shutdown
  async shutdown() {
    Logger.info("Shutting down Socket.io server...");

    // Disconnect all clients
    this.io.emit("server-shutdown", { message: "Server is shutting down" });

    this.io.close();
    Logger.info("Socket.io server shutdown complete");
  }
}

export default SocketManager;
