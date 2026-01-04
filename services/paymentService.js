/**
 * Payment Service
 * Supports Stripe payment gateway
 * Configure via environment variables
 */

import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

const PAYMENT_GATEWAY = process.env.PAYMENT_GATEWAY || "stripe"; // stripe only

/**
 * Create Payment Intent
 * @param {Number} amount - Amount in smallest currency unit (cents for USD)
 * @param {String} currency - Currency code (USD, AED, PKR, ZAR)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Payment intent object
 */
export const createPaymentIntent = async (
  amount,
  currency = "USD",
  metadata = {}
) => {
  try {
    switch (PAYMENT_GATEWAY.toLowerCase()) {
      case "stripe":
        return await createStripePaymentIntent(amount, currency, metadata);
      case "payfast":
        return await createPayFastPaymentIntent(amount, currency, metadata);
      default:
        // Fallback to Stripe
        return await createStripePaymentIntent(amount, currency, metadata);
    }
  } catch (error) {
    const Logger = (await import("../utils/logger.js")).default;
    Logger.error("Payment Intent Creation Error", error);
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
      case "stripe":
        return await confirmStripePayment(paymentIntentId, paymentMethodId);
      case "payfast":
        return await confirmPayFastPayment(paymentIntentId, paymentMethodId);
      default:
        return await confirmStripePayment(paymentIntentId, paymentMethodId);
    }
  } catch (error) {
    const Logger = (await import("../utils/logger.js")).default;
    Logger.error("Payment Confirmation Error", error);
    throw new Error(`Payment confirmation failed: ${error.message}`);
  }
};

/**
 * Stripe Payment Implementation
 */
const createStripePaymentIntent = async (amount, currency, metadata) => {
  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key not configured");
  }

  // Dynamic import to avoid errors if package not installed
  try {
    const stripe = (await import("stripe")).default(
      process.env.STRIPE_SECRET_KEY
    );

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
      metadata: paymentIntent.metadata,
    };
  } catch (error) {
    // If stripe package not installed, provide helpful error
    if (error.code === "MODULE_NOT_FOUND") {
      throw new Error("Stripe package not installed. Run: npm install stripe");
    }
    throw error;
  }
};

const confirmStripePayment = async (paymentIntentId, paymentMethodId) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key not configured");
  }

  try {
    const stripe = (await import("stripe")).default(
      process.env.STRIPE_SECRET_KEY
    );

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount_received: paymentIntent.amount_received / 100, // Convert from cents
      payment_method: paymentMethodId,
      created: paymentIntent.created,
    };
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      throw new Error("Stripe package not installed. Run: npm install stripe");
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
    throw new Error("PayFast credentials not configured");
  }

  // PayFast uses different flow - returns payment URL instead of client_secret
  return {
    id: `pf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount: amount,
    currency: currency,
    status: "pending",
    payment_url: `${
      process.env.PAYFAST_URL || "https://sandbox.payfast.co.za"
    }/eng/process`,
    metadata: metadata,
  };
};

const confirmPayFastPayment = async (paymentIntentId, paymentMethodId) => {
  // PayFast confirmation logic
  return {
    id: paymentIntentId,
    status: "succeeded",
    amount_received: 0,
    payment_method: paymentMethodId,
    created: Date.now(),
  };
};

/**
 * JazzCash Payment Implementation
 * NOTE: JazzCash is not used - only Stripe is supported
 * This function is kept for reference but not called
 */
const createJazzCashPaymentIntent = async (amount, currency, metadata) => {
  if (!process.env.JAZZCASH_MERCHANT_ID || !process.env.JAZZCASH_PASSWORD) {
    throw new Error("JazzCash credentials not configured");
  }

  const merchantId = process.env.JAZZCASH_MERCHANT_ID;
  const password = process.env.JAZZCASH_PASSWORD;
  // Use production URL by default, sandbox only if explicitly set
  const jazzcashUrl =
    process.env.JAZZCASH_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://payments.jazzcash.com.pk"
      : "https://sandbox.jazzcash.com.pk");

  // Generate unique transaction ID
  const pp_TxnRefNo = `T${Date.now()}${Math.random()
    .toString(36)
    .substr(2, 9)
    .toUpperCase()}`;

  // JazzCash requires amount in paisa (smallest currency unit for PKR)
  // For PKR: 1 PKR = 100 paisa
  // For other currencies, convert appropriately
  const amountInPaisa =
    currency === "PKR" ? Math.round(amount * 100) : Math.round(amount * 100);

  // Prepare payment data
  const paymentData = {
    pp_Version: "1.1",
    pp_TxnType: "MPAY",
    pp_Language: "EN",
    pp_MerchantID: merchantId,
    pp_SubMerchantID: "",
    pp_Password: password,
    pp_TxnRefNo: pp_TxnRefNo,
    pp_Amount: amountInPaisa.toString(),
    pp_TxnCurrency: currency || "PKR",
    pp_TxnDateTime: new Date().toISOString().replace(/[-:]/g, "").split(".")[0],
    pp_BillReference: metadata.billReference || pp_TxnRefNo,
    pp_Description: metadata.description || "Payment for Sello",
    pp_TxnExpiryDateTime: new Date(Date.now() + 30 * 60 * 1000)
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0],
    pp_ReturnURL:
      metadata.returnUrl ||
      `${
        process.env.NODE_ENV === "production"
          ? process.env.PRODUCTION_URL ||
            process.env.CLIENT_URL?.split(",")[0]?.trim()
          : process.env.CLIENT_URL?.split(",")[0]?.trim() ||
            "http://localhost:5173"
      }/payment/callback`,
    pp_SecureHash: "",
    ppmpf_1: metadata.userId || "",
    ppmpf_2: metadata.purpose || "",
    ppmpf_3: metadata.carId || "",
    ppmpf_4: metadata.duration || "",
    ppmpf_5: metadata.plan || "",
  };

  // Generate secure hash
  // JazzCash uses SHA256 hash of sorted string values
  const sortedKeys = Object.keys(paymentData)
    .filter((key) => key !== "pp_SecureHash")
    .sort();
  const hashString =
    sortedKeys.map((key) => paymentData[key]).join("&") + "&" + password;
  const secureHash = crypto
    .createHash("sha256")
    .update(hashString)
    .digest("hex");
  paymentData.pp_SecureHash = secureHash;

  return {
    id: pp_TxnRefNo,
    amount: amount,
    currency: currency || "PKR",
    status: "pending",
    payment_url: `${jazzcashUrl}/CustomerPortal/transactionmanagement/merchantform/`,
    payment_data: paymentData,
    metadata: metadata,
  };
};

const confirmJazzCashPayment = async (paymentIntentId, paymentMethodId) => {
  // NOTE: JazzCash is not used - only Stripe is supported
  // JazzCash confirmation is handled via webhook/callback
  // This function is kept for reference but not called
  return {
    id: paymentIntentId,
    status: "pending",
    amount_received: 0,
    payment_method: paymentMethodId,
    created: Date.now(),
  };
};

/**
 * Generate Invoice HTML
 * @param {Object} transaction - Transaction object
 * @returns {String} HTML invoice
 */
export const generateInvoice = (transaction) => {
  const invoiceDate = new Date(
    transaction.createdAt || Date.now()
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
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
                            <td>${transaction.transactionId || "N/A"}</td>
                        </tr>
                        <tr>
                            <td>Amount:</td>
                            <td>${transaction.amount} ${
    transaction.currency || "USD"
  }</td>
                        </tr>
                        <tr>
                            <td>Date:</td>
                            <td>${invoiceDate}</td>
                        </tr>
                        <tr>
                            <td>Status:</td>
                            <td>${transaction.status || "completed"}</td>
                        </tr>
                        <tr>
                            <td>Purpose:</td>
                            <td>${transaction.purpose || "Payment"}</td>
                        </tr>
                        ${
                          transaction.paymentMethod
                            ? `
                        <tr>
                            <td>Payment Method:</td>
                            <td>${transaction.paymentMethod}</td>
                        </tr>
                        `
                            : ""
                        }
                    </table>
                </div>
                <div class="total">
                    Total: ${transaction.amount} ${
    transaction.currency || "USD"
  }
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
      case "stripe":
        return await verifyStripePayment(transactionId);
      case "payfast":
        return await verifyPayFastPayment(transactionId);
      default:
        return await verifyStripePayment(transactionId);
    }
  } catch (error) {
    const Logger = (await import("../utils/logger.js")).default;
    Logger.error("Payment Verification Error", error);
    throw new Error(`Payment verification failed: ${error.message}`);
  }
};

const verifyStripePayment = async (transactionId) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key not configured");
  }

  try {
    const stripe = (await import("stripe")).default(
      process.env.STRIPE_SECRET_KEY
    );
    const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      verified: paymentIntent.status === "succeeded",
    };
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      throw new Error("Stripe package not installed");
    }
    throw error;
  }
};

const verifyPayFastPayment = async (transactionId) => {
  // PayFast verification logic
  return {
    id: transactionId,
    status: "succeeded",
    verified: true,
  };
};

/**
 * NOTE: JazzCash is not used - only Stripe is supported
 * This function is kept for reference but not called
 */
const verifyJazzCashPayment = async (transactionId, callbackData = null) => {
  if (!process.env.JAZZCASH_MERCHANT_ID || !process.env.JAZZCASH_PASSWORD) {
    throw new Error("JazzCash credentials not configured");
  }

  // If callback data is provided, verify the hash
  if (callbackData && typeof callbackData === "object") {
    const password = process.env.JAZZCASH_PASSWORD;

    // Filter out empty values and secure hash for hash calculation
    const sortedKeys = Object.keys(callbackData)
      .filter(
        (key) =>
          key !== "pp_SecureHash" &&
          callbackData[key] !== "" &&
          callbackData[key] != null
      )
      .sort();

    // Build hash string: sorted values joined by &, then append password
    const hashString =
      sortedKeys.map((key) => String(callbackData[key])).join("&") +
      "&" +
      password;
    const calculatedHash = crypto
      .createHash("sha256")
      .update(hashString)
      .digest("hex");

    // Verify hash (case-insensitive comparison)
    if (
      calculatedHash.toLowerCase() !==
      (callbackData.pp_SecureHash || "").toLowerCase()
    ) {
      return {
        id: transactionId,
        status: "failed",
        verified: false,
        error: "Hash verification failed",
      };
    }

    // Check response code (000 = success in JazzCash)
    const responseCode = String(callbackData.pp_ResponseCode || "").trim();
    const responseMessage = String(
      callbackData.pp_ResponseMessage || ""
    ).trim();
    const isSuccess =
      responseCode === "000" ||
      responseCode === "00" ||
      responseMessage.toLowerCase().includes("success");

    // Convert amount from paisa to PKR
    const amountInPaisa = callbackData.pp_Amount
      ? parseFloat(callbackData.pp_Amount)
      : 0;
    const amount = amountInPaisa / 100;

    return {
      id: callbackData.pp_TxnRefNo || transactionId,
      status: isSuccess ? "succeeded" : "failed",
      amount: amount,
      currency: callbackData.pp_TxnCurrency || "PKR",
      verified: isSuccess,
      responseCode: responseCode,
      responseMessage: responseMessage,
    };
  }

  // If no callback data, return pending status
  return {
    id: transactionId,
    status: "pending",
    verified: false,
  };
};
