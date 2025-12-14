import Logger from './logger.js';

/**
 * Phone Verification Utility
 * 
 * Note: This is a basic implementation. For production, integrate with:
 * - Twilio (recommended)
 * - AWS SNS
 * - Nexmo/Vonage
 * - Your local SMS provider
 */

/**
 * Generate a 6-digit verification code
 */
export const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send verification code via SMS
 * 
 * TODO: Integrate with actual SMS service (Twilio, AWS SNS, etc.)
 * For now, this is a placeholder that logs the code
 * 
 * @param {string} phoneNumber - Phone number to send code to
 * @param {string} code - Verification code
 * @returns {Promise<{success: boolean, sid?: string}>}
 */
export const sendVerificationCode = async (phoneNumber, code) => {
    try {
        // Check if Twilio is configured
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            const twilio = await import('twilio');
            const client = twilio.default(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );

            const message = await client.messages.create({
                body: `Your Sello verification code is: ${code}. This code expires in 10 minutes.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });

            Logger.info(`SMS verification code sent via Twilio`, { 
                phoneNumber: phoneNumber.substring(0, 4) + '****', 
                sid: message.sid 
            });

            return { success: true, sid: message.sid };
        } else {
            // Fallback: Log code for development (REMOVE IN PRODUCTION)
            Logger.warn(`SMS verification code for ${phoneNumber.substring(0, 4) + '****'}: ${code}`, {
                message: 'Twilio not configured. Code logged for development only.',
                phoneNumber: phoneNumber.substring(0, 4) + '****',
                code
            });

            // In production without SMS service, you should return an error
            if (process.env.NODE_ENV === 'production') {
                throw new Error('SMS service not configured. Please contact administrator.');
            }

            return { success: true, sid: 'dev-mode' };
        }
    } catch (error) {
        Logger.error('Error sending verification code', error, { phoneNumber: phoneNumber.substring(0, 4) + '****' });
        throw new Error(`Failed to send verification code: ${error.message}`);
    }
};

/**
 * Verify code
 * 
 * @param {string} storedCode - Code stored in database
 * @param {string} providedCode - Code provided by user
 * @param {Date} expiryDate - Expiry date of stored code
 * @returns {boolean}
 */
export const verifyCode = (storedCode, providedCode, expiryDate) => {
    if (!storedCode || !providedCode || !expiryDate) {
        return false;
    }

    // Check if code has expired
    if (new Date() > new Date(expiryDate)) {
        return false;
    }

    // Compare codes (case-insensitive)
    return storedCode.trim() === providedCode.trim();
};

/**
 * Create expiry date (10 minutes from now)
 */
export const createExpiryDate = () => {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10);
    return expiry;
};
