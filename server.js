import http from 'http';
import { app } from "./app.js";
import connectDB from './config/db.js';
import { initializeSocket } from './socket/socketServer.js';

connectDB().then(() => {
    const PORT = process.env.PORT || 4000;
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.io
    const io = initializeSocket(server);
    
    // Make io available globally (optional, for use in other files)
    app.set('io', io);
    
    server.listen(PORT, () => {
        console.log(`🚀 Server is running on the PORT:${PORT}`);
        console.log(`🔌 Socket.io initialized`);
        console.log(`📡 API available at http://localhost:${PORT}/api`);
    });
}).catch((error) => {
    console.error("❌ Failed to start server:", error);
    // Still try to start the server even if DB connection fails
    const PORT = process.env.PORT || 4000;
    const server = http.createServer(app);
    const io = initializeSocket(server);
    app.set('io', io);
    
    server.listen(PORT, () => {
        console.log(`⚠️  Server started on PORT:${PORT} but MongoDB is not connected`);
        console.log(`📡 API available at http://localhost:${PORT}/api`);
    });
});