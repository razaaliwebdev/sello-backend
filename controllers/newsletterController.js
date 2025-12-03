import Newsletter from '../models/newsletterModel.js';
import sendEmail from '../utils/sendEmail.js';

/**
 * Subscribe to Newsletter
 */
export const subscribeNewsletter = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        // Check if email already exists
        const existingSubscriber = await Newsletter.findOne({ email: email.toLowerCase() });

        if (existingSubscriber) {
            if (existingSubscriber.status === 'subscribed') {
                return res.status(200).json({
                    success: true,
                    message: "You are already subscribed to our newsletter!",
                    data: existingSubscriber
                });
            } else {
                // Re-subscribe
                existingSubscriber.status = 'subscribed';
                existingSubscriber.subscribedAt = new Date();
                existingSubscriber.unsubscribedAt = null;
                await existingSubscriber.save();

                // Send welcome back email
                try {
                    const welcomeBackHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Welcome Back to Sello Newsletter</title>
                        </head>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                            <div style="background-color: #FF6B35; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">Welcome Back!</h1>
                            </div>
                            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px;">
                                <p style="font-size: 16px; margin-top: 0;">Hello,</p>
                                <p style="font-size: 16px;">
                                    We're thrilled to have you back! You've successfully re-subscribed to the Sello newsletter.
                                </p>
                                <p style="font-size: 16px;">
                                    You'll now receive:
                                </p>
                                <ul style="font-size: 16px; padding-left: 20px;">
                                    <li>Latest car listings and deals</li>
                                    <li>Pricing updates and market trends</li>
                                    <li>Shopping tips and guides</li>
                                    <li>Exclusive promotions and offers</li>
                                </ul>
                                <p style="font-size: 16px;">
                                    Thank you for staying connected with Sello!
                                </p>
                                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                                <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                                    If you didn't subscribe to this newsletter, please contact us.
                                </p>
                            </div>
                        </body>
                        </html>
                    `;
                    await sendEmail(email.toLowerCase(), 'Welcome Back to Sello Newsletter!', welcomeBackHtml);
                } catch (emailError) {
                    console.error("Newsletter welcome back email error:", emailError.message);
                }

                return res.status(200).json({
                    success: true,
                    message: "Successfully re-subscribed to our newsletter!",
                    data: existingSubscriber
                });
            }
        }

        // Create new subscription
        const subscriber = await Newsletter.create({
            email: email.toLowerCase(),
            status: 'subscribed',
            source: 'website'
        });

        // Send welcome email
        try {
            const welcomeHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to Sello Newsletter</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                    <div style="background-color: #FF6B35; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Welcome to Sello!</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px;">
                        <p style="font-size: 16px; margin-top: 0;">Hello,</p>
                        <p style="font-size: 16px;">
                            Thank you for subscribing to the Sello newsletter! We're excited to have you on board.
                        </p>
                        <p style="font-size: 16px;">
                            You'll now receive:
                        </p>
                        <ul style="font-size: 16px; padding-left: 20px;">
                            <li>📧 Latest car listings and deals</li>
                            <li>💰 Pricing updates and market trends</li>
                            <li>💡 Shopping tips and guides</li>
                            <li>🎁 Exclusive promotions and offers</li>
                        </ul>
                        <p style="font-size: 16px;">
                            Stay tuned for our next update!
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #FF6B35; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Visit Sello</a>
                        </div>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                            If you didn't subscribe to this newsletter, please ignore this email or contact us.
                        </p>
                    </div>
                </body>
                </html>
            `;
            await sendEmail(email.toLowerCase(), 'Welcome to Sello Newsletter!', welcomeHtml);
            console.log(`✓ Newsletter welcome email sent to ${email}`);
        } catch (emailError) {
            console.error("Newsletter welcome email error:", emailError.message);
            // Still return success even if email fails
        }

        return res.status(201).json({
            success: true,
            message: "Successfully subscribed to our newsletter! Check your email for confirmation.",
            data: subscriber
        });
    } catch (error) {
        console.error("Subscribe Newsletter Error:", error.message);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(200).json({
                success: true,
                message: "You are already subscribed to our newsletter!",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Unsubscribe from Newsletter
 */
export const unsubscribeNewsletter = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

        if (!subscriber) {
            return res.status(404).json({
                success: false,
                message: "Email not found in our newsletter list."
            });
        }

        if (subscriber.status === 'unsubscribed') {
            return res.status(200).json({
                success: true,
                message: "You are already unsubscribed."
            });
        }

        subscriber.status = 'unsubscribed';
        subscriber.unsubscribedAt = new Date();
        await subscriber.save();

        return res.status(200).json({
            success: true,
            message: "Successfully unsubscribed from our newsletter."
        });
    } catch (error) {
        console.error("Unsubscribe Newsletter Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get All Newsletter Subscribers (Admin only)
 */
export const getAllSubscribers = async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view subscribers."
            });
        }

        const { status, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (status) {
            query.status = status;
        }

        const subscribers = await Newsletter.find(query)
            .sort({ subscribedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Newsletter.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Subscribers retrieved successfully.",
            data: {
                subscribers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Get All Subscribers Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

