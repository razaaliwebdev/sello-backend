import http from 'http';
import { app } from "./app.js";
import connectDB from './config/db.js';
import { initializeSocket } from './socket/socketServer.js';
import { initializeRoles } from './controllers/roleController.js';
import Logger from './utils/logger.js';
import mongoose from 'mongoose';

// Optional: Setup cron jobs for background tasks
let cronJobs = null;
if (process.env.ENABLE_CRON_JOBS === 'true') {
    try {
        const cron = await import('node-cron');

        // Run boost expiration every 30 minutes
        cron.default.schedule('*/30 * * * *', async () => {
            Logger.info('Running boost expiration job...');
            try {
                const { default: runBoostExpiration } = await import('./scripts/boostExpirationJob.js');
                // Note: The script handles its own DB connection
            } catch (error) {
                Logger.error('Boost expiration cron job failed', error);
            }
        });

        // Run subscription expiration daily at midnight
        cron.default.schedule('0 0 * * *', async () => {
            Logger.info('Running subscription expiration job...');
            try {
                const { default: runSubscriptionExpiration } = await import('./scripts/subscriptionExpirationJob.js');
                // Note: The script handles its own DB connection
            } catch (error) {
                Logger.error('Subscription expiration cron job failed', error);
            }
        });

        Logger.info('Cron jobs initialized');
    } catch (error) {
        Logger.warn('node-cron not installed. Background jobs disabled. Install with: npm install node-cron', { error: error.message });
    }
}

// Start server regardless of DB connection status
const startServer = () => {
    try {
        const PORT = process.env.PORT || 3000;
        const server = http.createServer(app);

        // Initialize Socket.io with error handling
        let io;
        try {
            io = initializeSocket(server);
            app.set('io', io);
        } catch (socketError) {
            console.error('Socket.io initialization error:', socketError);
            // Continue without socket.io if it fails
        }

        server.listen(PORT, () => {
            Logger.info(`Server is running on PORT:${PORT}`);
            Logger.info(`API available at http://localhost:${PORT}/api`);
            console.log(`🚀 Server is running on PORT:${PORT}`);
            console.log(`📡 API available at http://localhost:${PORT}/api`);
            if (io) {
                console.log(`🔌 Socket.io initialized`);
            }
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
                process.exit(1);
            } else {
                console.error('❌ Server error:', error);
            }
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Try to connect to DB, but start server anyway
connectDB().then(() => {
    // Initialize default roles only if DB is connected
    if (mongoose.connection.readyState === 1) {
        try {
            initializeRoles();
        } catch (roleError) {
            console.error('Role initialization error:', roleError);
        }
    }
    startServer();
}).catch((error) => {
    console.error('DB connection error (server will start anyway):', error.message);
    // Start server even if DB connection fails
    startServer();
});