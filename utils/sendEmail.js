import nodemailer from "nodemailer";
import Logger from "./logger.js";

const sendEmail = async (to, subject, html, options = {}) => {
  // Check if email notifications are enabled
  const emailNotificationsEnabled =
    process.env.ENABLE_EMAIL_NOTIFICATIONS !== "false";

  if (!emailNotificationsEnabled) {
    Logger.warn("Email notifications disabled via ENABLE_EMAIL_NOTIFICATIONS", {
      to,
      subject,
    });
    return { messageId: "disabled", accepted: [to], actuallySent: false };
  }

  // Additional check for SMTP issues in development
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DISABLE_EMAIL_IN_DEV === "true"
  ) {
    Logger.warn("Email disabled in development via DISABLE_EMAIL_IN_DEV", {
      to,
      subject,
    });
    return { messageId: "dev-disabled", accepted: [to], actuallySent: false };
  }

  // If async option is enabled, send email in background
  if (options.async) {
    // Send email asynchronously without waiting
    setImmediate(async () => {
      try {
        await sendEmailSync(to, subject, html);
        Logger.info("Async email sent successfully", { to, subject });
      } catch (error) {
        Logger.error("Async email sending failed", error, { to, subject });
        // Don't throw error for async emails - just log it
      }
    });

    // Return immediately with a placeholder
    return {
      messageId: `async-${Date.now()}`,
      accepted: [to],
      actuallySent: true,
      async: true,
    };
  }

  // Send email synchronously (default behavior)
  return await sendEmailSync(to, subject, html);
};

// Separate function for synchronous email sending
const sendEmailSync = async (to, subject, html) => {
  // Validate email configuration
  const missingVars = [];
  if (!process.env.SMTP_HOST) missingVars.push("SMTP_HOST");
  if (!process.env.SMTP_PORT) missingVars.push("SMTP_PORT");
  if (!process.env.SMTP_MAIL) missingVars.push("SMTP_MAIL");
  if (!process.env.SMTP_PASSWORD) missingVars.push("SMTP_PASSWORD");

  if (missingVars.length > 0) {
    // Check if we're in production - if so, we MUST have SMTP configured
    const isProduction = process.env.NODE_ENV === "production";
    const isDevelopment = !isProduction;

    // Log the missing configuration
    Logger.warn("Email configuration missing", { missingVars });
    Logger.warn(
      "Email will NOT be sent. Please configure SMTP in your .env file.",
      {
        required: ["SMTP_HOST", "SMTP_PORT", "SMTP_MAIL", "SMTP_PASSWORD"],
      }
    );

    if (isDevelopment) {
      // Return a special marker so we know email wasn't actually sent
      return { messageId: "dev-mode", accepted: [to], actuallySent: false };
    }

    // In production, throw error
    const errorMsg = `Email configuration is missing. Required environment variables: ${missingVars.join(
      ", "
    )}`;
    Logger.error("SMTP Configuration Error", new Error(errorMsg), {
      missingVars,
    });
    throw new Error(errorMsg);
  }

  // Extract email user - handle both formats: "email@domain.com" or "Name <email@domain.com>"
  let emailUser =
    process.env.SMTP_MAIL?.match(/<(.+)>/)?.[1] || process.env.SMTP_MAIL;

  // Determine username format to try
  const emailPrefix = emailUser?.split("@")[0]; // Just the part before @
  let smtpUsername = process.env.SMTP_USERNAME || emailUser;

  // Warn if SMTP_USERNAME and SMTP_MAIL don't match (common mistake)
  if (
    process.env.SMTP_USERNAME &&
    emailUser &&
    process.env.SMTP_USERNAME !== emailUser &&
    process.env.SMTP_USERNAME !== emailPrefix
  ) {
    Logger.warn("⚠️ SMTP_USERNAME and SMTP_MAIL do not match!", {
      smtpMail: emailUser,
      smtpUsername: process.env.SMTP_USERNAME,
      warning:
        "These should be for the SAME email account. This may cause authentication to fail.",
    });
  }

  // Log configuration (without password) for debugging
  Logger.info("SMTP Configuration", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === "465",
    username: smtpUsername,
    email: emailUser,
    emailPrefix: emailPrefix,
    passwordSet: !!process.env.SMTP_PASSWORD,
    passwordLength: process.env.SMTP_PASSWORD?.length || 0,
  });

  // Helper function to create transporter with proper SSL/TLS
  const createTransporter = (username, portOverride = null) => {
    const port = portOverride || parseInt(process.env.SMTP_PORT) || 587;
    const isSSL = port === 465;

    const config = {
      host: process.env.SMTP_HOST,
      port: port,
      secure: isSSL, // true for 465 (SSL), false for 587 (TLS)
      auth: {
        user: username,
        pass: process.env.SMTP_PASSWORD,
      },
      connectionTimeout: 15000, // Increased from 8s to 15s
      greetingTimeout: 15000, // Increased from 8s to 15s
      socketTimeout: 15000, // Increased from 8s to 15s
    };

    if (isSSL) {
      // For SSL (port 465), don't use TLS
      config.tls = {
        rejectUnauthorized: false,
      };
    } else {
      // For TLS (port 587), use TLS
      config.requireTLS = true;
      config.tls = {
        rejectUnauthorized: false,
      };
    }

    Logger.info(`Creating SMTP transporter`, {
      host: config.host,
      port: config.port,
      secure: config.secure,
      username: username,
      passwordLength: process.env.SMTP_PASSWORD?.length || 0,
    });

    return nodemailer.createTransport(config);
  };

  // Try to authenticate - always verify connection first
  let transporter;
  let lastError = null;
  const attemptedUsernames = [];

  // Determine which usernames to try
  // If SMTP_USERNAME is set, try it AND its prefix
  // Otherwise, try email and its prefix
  let usernamesToTry = [];
  if (process.env.SMTP_USERNAME) {
    const usernamePrefix = smtpUsername.includes("@")
      ? smtpUsername.split("@")[0]
      : null;
    usernamesToTry = [smtpUsername];
    if (usernamePrefix && usernamePrefix !== smtpUsername) {
      usernamesToTry.push(usernamePrefix);
    }
    // Also try the email from SMTP_MAIL and its prefix (in case they set wrong username)
    if (emailUser && emailUser !== smtpUsername) {
      usernamesToTry.push(emailUser);
      if (emailPrefix && emailPrefix !== emailUser) {
        usernamesToTry.push(emailPrefix);
      }
    }
  } else {
    usernamesToTry = [emailUser, emailPrefix].filter(Boolean);
  }

  // Remove duplicates
  usernamesToTry = [...new Set(usernamesToTry)];

  Logger.info(
    `Will attempt SMTP authentication with ${usernamesToTry.length} username format(s):`,
    usernamesToTry
  );

  // Determine which ports to try
  const configuredPort = parseInt(process.env.SMTP_PORT) || 587;
  const portsToTry = [configuredPort];
  // If configured port is 465, also try 587 (many hosts use 587 for TLS)
  if (configuredPort === 465) {
    portsToTry.push(587);
  }
  // If configured port is 587, also try 465 (some hosts use 465 for SSL)
  if (configuredPort === 587) {
    portsToTry.push(465);
  }

  // Try each username format with each port
  let connectionSuccess = false;
  for (const usernameToTry of usernamesToTry) {
    if (connectionSuccess) break;

    for (const portToTry of portsToTry) {
      attemptedUsernames.push(`${usernameToTry}@${portToTry}`);
      transporter = createTransporter(usernameToTry, portToTry);

      try {
        Logger.info(
          `Attempting SMTP verification with username: ${usernameToTry}, port: ${portToTry}`
        );
        await transporter.verify();
        Logger.info(
          `✅ SMTP connection verified successfully with username: ${usernameToTry}, port: ${portToTry}`
        );
        smtpUsername = usernameToTry; // Update to the working username
        lastError = null; // Clear any previous errors
        connectionSuccess = true;
        break; // Success! Exit both loops
      } catch (verifyError) {
        Logger.warn(
          `❌ SMTP verification failed with username: ${usernameToTry}, port: ${portToTry}`,
          {
            error: verifyError.message,
            responseCode: verifyError.responseCode,
            code: verifyError.code,
          }
        );
        lastError = verifyError;

        // If it's a timeout or connection error on this port, try next port
        if (
          verifyError.code === "ETIMEDOUT" ||
          verifyError.code === "ECONNECTION" ||
          verifyError.message.includes("timeout") ||
          verifyError.message.includes("ECONNREFUSED")
        ) {
          Logger.warn(
            `Port ${portToTry} timed out, will try other ports if available`
          );
          // Continue to next port
          continue;
        }

        // If it's an auth error, try next username (but keep this port)
        if (
          verifyError.code === "EAUTH" ||
          verifyError.responseCode === 535 ||
          verifyError.message.includes("Incorrect authentication") ||
          verifyError.message.includes("Invalid login")
        ) {
          // Continue to next username
          break;
        }

        // Other errors - try next port
        continue;
      }
    }
  }

  // Handle timeout/connection errors
  if (
    lastError &&
    (lastError.code === "ETIMEDOUT" ||
      lastError.code === "ECONNECTION" ||
      lastError.message.includes("timeout") ||
      lastError.message.includes("ECONNREFUSED"))
  ) {
    const details = lastError.message || "Connection timeout or refused";
    Logger.error("❌ SMTP CONNECTION TIMEOUT/REFUSED", {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      error: lastError.message,
      code: lastError.code,
    });

    // In development, allow continuing without email
    if (process.env.NODE_ENV !== "production") {
      Logger.warn(
        "⚠️ Email disabled in development due to SMTP connection issues",
        {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
        }
      );
      return {
        messageId: "dev-smtp-failed",
        accepted: [to],
        actuallySent: false,
      };
    }

    throw new Error(
      `SMTP Connection Failed: ${details}. Cannot reach ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}. Check your SMTP_HOST, SMTP_PORT, firewall settings, or contact your hosting provider.`
    );
  }

  // If we have an auth error after trying all formats, throw it
  if (
    lastError &&
    (lastError.responseCode === 535 ||
      lastError.code === "EAUTH" ||
      lastError.message.includes("Incorrect authentication") ||
      lastError.message.includes("Invalid login"))
  ) {
    Logger.error("❌ CRITICAL SMTP ERROR: AUTHENTICATION FAILED", {
      message:
        "SMTP authentication failed with ALL attempted username formats.",
      attemptedUsernames: attemptedUsernames,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      email: emailUser,
      passwordLength: process.env.SMTP_PASSWORD?.length || 0,
      errorDetails: {
        responseCode: lastError.responseCode,
        response: lastError.response,
        message: lastError.message,
        code: lastError.code,
        stack: lastError.stack,
      },
      troubleshooting: [
        "1. Go to cPanel → Email Accounts → Click 'Connect Devices' next to your email",
        "2. Copy EXACT values from 'Mail Client Manual Settings' → Outgoing (SMTP)",
        "3. Verify SMTP_HOST matches 'Outgoing Server' exactly (no spaces, correct domain)",
        "4. Verify SMTP_PORT matches exactly (465 for SSL or 587 for TLS)",
        "5. Verify SMTP_USERNAME matches the EXACT username shown in cPanel",
        "6. Verify SMTP_PASSWORD is the email account password (NOT cPanel password)",
        "7. Test webmail login: https://yourdomain.com:2096 with same credentials",
        "8. If webmail login fails, your password is wrong - reset it in cPanel",
        "9. Make sure SMTP_MAIL and SMTP_USERNAME are for the SAME email account",
      ],
    });

    const details =
      lastError.response || lastError.message || "Invalid credentials";
    throw new Error(
      `SMTP Authentication Failed: ${details}. Attempted usernames: ${attemptedUsernames.join(
        ", "
      )}. Check server logs for detailed troubleshooting steps.`
    );
  }

  // If we have a non-auth error, throw it
  if (lastError) {
    throw lastError;
  }

  const mailOptions = {
    from: `"${process.env.SITE_NAME || "Sello"}" <${emailUser}>`,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    // Log successful email send
    Logger.info("Email sent successfully", {
      to: to,
      subject: subject,
      messageId: info.messageId || "unknown",
      accepted: info.accepted || [],
      rejected: info.rejected || [],
    });

    // Ensure consistent return format
    return {
      messageId: info.messageId || `sent-${Date.now()}`,
      accepted: info.accepted || [to],
      rejected: info.rejected || [],
      actuallySent: true,
    };
  } catch (sendError) {
    // Log the error with details
    Logger.error("Email sending failed", sendError, {
      to: to,
      subject: subject,
      errorCode: sendError.code,
      responseCode: sendError.responseCode,
    });

    // Provide more specific error messages
    let errorMessage = "Failed to send email";
    if (sendError.code === "EAUTH" || sendError.responseCode === 535) {
      const details =
        sendError.response || sendError.message || "Invalid credentials";
      errorMessage = `SMTP authentication failed: ${details}. Please check your email credentials.`;
      Logger.error(
        "CRITICAL EMAIL ERROR: SMTP AUTHENTICATION FAILED",
        sendError,
        {
          message:
            "SMTP authentication failed. Please verify your credentials match cPanel exactly.",
          instructions: [
            "1. Open cPanel → Email Accounts → Click 'Connect Devices' next to your email",
            "2. Copy EXACT values from 'Mail Client Manual Settings' → Outgoing (SMTP)",
            "3. Set SMTP_HOST to the exact 'Outgoing Server' value",
            "4. Set SMTP_PORT to the exact port shown (587 or 465)",
            "5. Set SMTP_MAIL to your full email address",
            "6. Set SMTP_PASSWORD to the email account password (NOT cPanel password)",
            "7. Set SMTP_USERNAME to the EXACT username shown in cPanel (may be full email or just prefix)",
            "8. Test webmail login with same credentials to verify they work",
          ],
          smtpConfig: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            username: smtpUsername,
            email: emailUser,
            passwordLength: process.env.SMTP_PASSWORD?.length || 0,
          },
          errorDetails: {
            responseCode: sendError.responseCode,
            response: sendError.response,
            message: sendError.message,
            code: sendError.code,
          },
        }
      );
    } else if (sendError.code === "ECONNECTION") {
      errorMessage =
        "Could not connect to SMTP server. Please check SMTP_HOST and SMTP_PORT.";
      Logger.error("SMTP CONNECTION ERROR", sendError, {
        message: "Cannot connect to SMTP server.",
        instructions: [
          "1. Verify SMTP_HOST is correct (e.g., mail.yourdomain.com)",
          "2. Verify SMTP_PORT is correct (587 or 465)",
          "3. Check if your firewall is blocking the connection",
          "4. For cPanel: Contact your hosting provider if connection fails",
        ],
      });
    } else if (sendError.code === "ETIMEDOUT") {
      errorMessage = "SMTP server connection timeout. Please try again later.";
    } else if (sendError.responseCode) {
      errorMessage = `SMTP server error: ${sendError.responseCode} - ${
        sendError.response || sendError.message
      }`;
    } else {
      errorMessage = sendError.message || "Failed to send email";
    }

    throw new Error(errorMessage);
  }
};

export default sendEmail;
