import { OAuth2Client } from 'google-auth-library';
import Logger from '../utils/logger.js';

// Use environment variable or fallback to the same client ID as frontend
const googleClientId = process.env.GOOGLE_CLIENT_ID || "90770038046-jpumef82nch1o3amujieujs2m1hr73rt.apps.googleusercontent.com";

// Warn if using fallback (development only)
if (!process.env.GOOGLE_CLIENT_ID && process.env.NODE_ENV !== 'production') {
    Logger.warn('GOOGLE_CLIENT_ID not set, using fallback client ID', {
        message: 'For production, set GOOGLE_CLIENT_ID in your .env file'
    });
}

const client = new OAuth2Client(googleClientId);

export default client;
