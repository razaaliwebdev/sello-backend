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
 * Supports Twilio integration. Falls back to development logging if Twilio is not configured.
 * 
 * @param {string} phoneNumber - Phone number to send code to
 * @param {string} code - Verification code
 * @returns {Promise<{success: boolean, sid?: string}>}
 */
export const sendVerificationCode = async (phoneNumber, code) => {
    try {
        // Validate phone number format
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            throw new Error('Invalid phone number format');
        }

        // Normalize phone number (remove spaces, dashes, etc.)
        const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
        
        // Basic phone number validation
        if (!/^\+?\d{9,15}$/.test(normalizedPhone)) {
            throw new Error('Invalid phone number format. Must be 9-15 digits with optional country code.');
        }

        // Check if Twilio is configured
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
            // Validate Twilio credentials format
            if (!twilioAccountSid.startsWith('AC') || twilioAccountSid.length !== 34) {
                Logger.warn('Invalid Twilio Account SID format');
                throw new Error('Twilio Account SID is invalid');
            }

            if (twilioAuthToken.length !== 32) {
                Logger.warn('Invalid Twilio Auth Token format');
                throw new Error('Twilio Auth Token is invalid');
            }

            try {
                const twilio = await import('twilio');
                const client = twilio.default(twilioAccountSid, twilioAuthToken);

                // Validate Twilio phone number format
                if (!twilioPhoneNumber.startsWith('+')) {
                    Logger.warn('Twilio phone number should start with +');
                }

                const message = await client.messages.create({
                    body: `Your Sello verification code is: ${code}. This code expires in 10 minutes.`,
                    from: twilioPhoneNumber,
                    to: normalizedPhone
                });

                Logger.info(`SMS verification code sent via Twilio`, { 
                    phoneNumber: normalizedPhone.substring(0, 4) + '****', 
                    sid: message.sid,
                    status: message.status
                });

                return { success: true, sid: message.sid };
            } catch (twilioError) {
                // Handle specific Twilio errors
                if (twilioError.code === 21211) {
                    Logger.error('Invalid phone number format for Twilio', { phoneNumber: normalizedPhone.substring(0, 4) + '****' });
                    throw new Error('Invalid phone number format');
                } else if (twilioError.code === 21608) {
                    Logger.error('Twilio phone number not verified (trial account)', { phoneNumber: normalizedPhone.substring(0, 4) + '****' });
                    throw new Error('Phone number not verified. Please verify your phone number in Twilio console.');
                } else if (twilioError.code === 20003) {
                    Logger.error('Twilio authentication failed', { phoneNumber: normalizedPhone.substring(0, 4) + '****' });
                    throw new Error('SMS service authentication failed. Please check Twilio credentials.');
                } else {
                    Logger.error('Twilio API error', twilioError, { phoneNumber: normalizedPhone.substring(0, 4) + '****' });
                    throw new Error(`Failed to send SMS: ${twilioError.message}`);
                }
            }
        } else {
            // Fallback: Log code for development (REMOVE IN PRODUCTION)
            const missingVars = [];
            if (!twilioAccountSid) missingVars.push('TWILIO_ACCOUNT_SID');
            if (!twilioAuthToken) missingVars.push('TWILIO_AUTH_TOKEN');
            if (!twilioPhoneNumber) missingVars.push('TWILIO_PHONE_NUMBER');

            Logger.warn(`SMS verification code for ${normalizedPhone.substring(0, 4) + '****'}: ${code}`, {
                message: 'Twilio not configured. Code logged for development only.',
                missingVars,
                phoneNumber: normalizedPhone.substring(0, 4) + '****',
                code
            });

            // In production without SMS service, you should return an error
            if (process.env.NODE_ENV === 'production') {
                throw new Error('SMS service not configured. Please contact administrator.');
            }

            return { success: true, sid: 'dev-mode' };
        }
    } catch (error) {
        Logger.error('Error sending verification code', error, { 
            phoneNumber: phoneNumber ? phoneNumber.substring(0, 4) + '****' : 'unknown' 
        });
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
