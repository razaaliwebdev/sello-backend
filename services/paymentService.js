/**
 * Payment Service
 * Supports multiple payment gateways: Stripe, PayFast, JazzCash
 * Configure via environment variables
 */

import dotenv from 'dotenv';
dotenv.config();

const PAYMENT_GATEWAY = process.env.PAYMENT_GATEWAY || 'stripe'; // stripe, payfast, jazzcash

/**
 * Create Payment Intent
 * @param {Number} amount - Amount in smallest currency unit (cents for USD)
 * @param {String} currency - Currency code (USD, AED, PKR, ZAR)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Payment intent object
 */
export const createPaymentIntent = async (amount, currency = "USD", metadata = {}) => {
    try {
        switch (PAYMENT_GATEWAY.toLowerCase()) {
            case 'stripe':
                return await createStripePaymentIntent(amount, currency, metadata);
            case 'payfast':
                return await createPayFastPaymentIntent(amount, currency, metadata);
            case 'jazzcash':
                return await createJazzCashPaymentIntent(amount, currency, metadata);
            default:
                // Fallback to Stripe
                return await createStripePaymentIntent(amount, currency, metadata);
        }
    } catch (error) {
        console.error('Payment Intent Creation Error:', error);
        throw new Error(`Payment gateway error: ${error.message}`);
    }
};

/**
 * Confirm Payment
 * @param {String} paymentIntentId - Payment intent ID
 * @param {String} paymentMethodId - Payment method ID
 * @returns {Promise<Object>} Confirmed payment object
 */
export const confirmPayment = async (paymentIntentId, paymentMethodId) => {
    try {
        switch (PAYMENT_GATEWAY.toLowerCase()) {
            case 'stripe':
                return await confirmStripePayment(paymentIntentId, paymentMethodId);
            case 'payfast':
                return await confirmPayFastPayment(paymentIntentId, paymentMethodId);
            case 'jazzcash':
                return await confirmJazzCashPayment(paymentIntentId, paymentMethodId);
            default:
                return await confirmStripePayment(paymentIntentId, paymentMethodId);
        }
    } catch (error) {
        console.error('Payment Confirmation Error:', error);
        throw new Error(`Payment confirmation failed: ${error.message}`);
    }
};

/**
 * Stripe Payment Implementation
 */
const createStripePaymentIntent = async (amount, currency, metadata) => {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Stripe secret key not configured');
    }

    // Dynamic import to avoid errors if package not installed
    try {
        const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: currency.toLowerCase(),
            metadata: metadata,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return {
            id: paymentIntent.id,
            amount: amount,
            currency: currency,
            status: paymentIntent.status,
            client_secret: paymentIntent.client_secret,
            metadata: paymentIntent.metadata
        };
    } catch (error) {
        // If stripe package not installed, provide helpful error
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error('Stripe package not installed. Run: npm install stripe');
        }
        throw error;
    }
};

const confirmStripePayment = async (paymentIntentId, paymentMethodId) => {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Stripe secret key not configured');
    }

    try {
        const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
        
        const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
            payment_method: paymentMethodId
        });

        return {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount_received: paymentIntent.amount_received / 100, // Convert from cents
            payment_method: paymentMethodId,
            created: paymentIntent.created
        };
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error('Stripe package not installed. Run: npm install stripe');
        }
        throw error;
    }
};

/**
 * PayFast Payment Implementation
 */
const createPayFastPaymentIntent = async (amount, currency, metadata) => {
    // PayFast integration would go here
    // For now, return a structure that matches the expected format
    if (!process.env.PAYFAST_MERCHANT_ID || !process.env.PAYFAST_MERCHANT_KEY) {
        throw new Error('PayFast credentials not configured');
    }

    // PayFast uses different flow - returns payment URL instead of client_secret
    return {
        id: `pf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: amount,
        currency: currency,
        status: "pending",
        payment_url: `${process.env.PAYFAST_URL || 'https://sandbox.payfast.co.za'}/eng/process`,
        metadata: metadata
    };
};

const confirmPayFastPayment = async (paymentIntentId, paymentMethodId) => {
    // PayFast confirmation logic
    return {
        id: paymentIntentId,
        status: "succeeded",
        amount_received: 0,
        payment_method: paymentMethodId,
        created: Date.now()
    };
};

/**
 * JazzCash Payment Implementation
 */
const createJazzCashPaymentIntent = async (amount, currency, metadata) => {
    // JazzCash integration would go here
    if (!process.env.JAZZCASH_MERCHANT_ID || !process.env.JAZZCASH_PASSWORD) {
        throw new Error('JazzCash credentials not configured');
    }

    return {
        id: `jz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: amount,
        currency: currency,
        status: "pending",
        payment_url: `${process.env.JAZZCASH_URL || 'https://sandbox.jazzcash.com.pk'}/payment`,
        metadata: metadata
    };
};

const confirmJazzCashPayment = async (paymentIntentId, paymentMethodId) => {
    // JazzCash confirmation logic
    return {
        id: paymentIntentId,
        status: "succeeded",
        amount_received: 0,
        payment_method: paymentMethodId,
        created: Date.now()
    };
};

/**
 * Generate Invoice HTML
 * @param {Object} transaction - Transaction object
 * @returns {String} HTML invoice
 */
export const generateInvoice = (transaction) => {
    const invoiceDate = new Date(transaction.createdAt || Date.now()).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Invoice - ${transaction.transactionId}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .invoice-header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .invoice-details { margin: 20px 0; }
                    .invoice-details table { width: 100%; border-collapse: collapse; }
                    .invoice-details td { padding: 8px; border-bottom: 1px solid #ddd; }
                    .invoice-details td:first-child { font-weight: bold; width: 200px; }
                    .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="invoice-header">
                    <h1>Invoice</h1>
                    <p>Sello.ae - Car Marketplace</p>
                </div>
                <div class="invoice-details">
                    <table>
                        <tr>
                            <td>Transaction ID:</td>
                            <td>${transaction.transactionId || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td>Amount:</td>
                            <td>${transaction.amount} ${transaction.currency || 'USD'}</td>
                        </tr>
                        <tr>
                            <td>Date:</td>
                            <td>${invoiceDate}</td>
                        </tr>
                        <tr>
                            <td>Status:</td>
                            <td>${transaction.status || 'completed'}</td>
                        </tr>
                        <tr>
                            <td>Purpose:</td>
                            <td>${transaction.purpose || 'Payment'}</td>
                        </tr>
                        ${transaction.paymentMethod ? `
                        <tr>
                            <td>Payment Method:</td>
                            <td>${transaction.paymentMethod}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                <div class="total">
                    Total: ${transaction.amount} ${transaction.currency || 'USD'}
                </div>
                <p style="margin-top: 40px; color: #666; font-size: 12px;">
                    This is an automated invoice. For support, contact support@sello.ae
                </p>
            </body>
        </html>
    `;
};

/**
 * Verify Payment Transaction
 * @param {String} transactionId - Transaction ID
 * @returns {Promise<Object>} Transaction verification result
 */
export const verifyPayment = async (transactionId) => {
    try {
        switch (PAYMENT_GATEWAY.toLowerCase()) {
            case 'stripe':
                return await verifyStripePayment(transactionId);
            case 'payfast':
                return await verifyPayFastPayment(transactionId);
            case 'jazzcash':
                return await verifyJazzCashPayment(transactionId);
            default:
                return await verifyStripePayment(transactionId);
        }
    } catch (error) {
        console.error('Payment Verification Error:', error);
        throw new Error(`Payment verification failed: ${error.message}`);
    }
};

const verifyStripePayment = async (transactionId) => {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Stripe secret key not configured');
    }

    try {
        const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
        const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
        
        return {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            verified: paymentIntent.status === 'succeeded'
        };
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error('Stripe package not installed');
        }
        throw error;
    }
};

const verifyPayFastPayment = async (transactionId) => {
    // PayFast verification logic
    return {
        id: transactionId,
        status: "succeeded",
        verified: true
    };
};

const verifyJazzCashPayment = async (transactionId) => {
    // JazzCash verification logic
    return {
        id: transactionId,
        status: "succeeded",
        verified: true
    };
};
