import http from 'http';
import { app } from "./app.js";
import connectDB from './config/db.js';
import { initializeSocket } from './socket/socketServer.js';
import { initializeRoles } from './controllers/roleController.js';
import Logger from './utils/logger.js';

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

connectDB().then(() => {
    // Initialize default roles
    initializeRoles();
    const PORT = process.env.PORT || 4000;
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.io
    const io = initializeSocket(server);
    
    // Make io available globally (optional, for use in other files)
    app.set('io', io);
    
    server.listen(PORT, () => {
        Logger.info(`Server is running on PORT:${PORT}`);
        Logger.info(`Socket.io initialized`);
        Logger.info(`API available at http://localhost:${PORT}/api`);
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