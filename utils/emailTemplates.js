/**
 * Professional Email Templates for SELLO
 * Uses brand colors: Primary #FFA602 (orange/yellow)
 */

export const getEmailStyles = () => `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f8f9fa;
    }
    
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    
    .header {
      background: linear-gradient(135deg, #FFA602 0%, #FFB84D 100%);
      padding: 30px 40px;
      text-align: center;
    }
    
    .logo {
      font-size: 32px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    
    .tagline {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 500;
    }
    
    .content {
      padding: 40px;
    }
    
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #333333;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    
    .subtitle {
      font-size: 16px;
      color: #666666;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    
    .otp-container {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 2px solid #FFA602;
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
    }
    
    .otp-code {
      font-size: 36px;
      font-weight: 800;
      color: #FFA602;
      letter-spacing: 8px;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
    }
    
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #FFA602 0%, #FFB84D 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(255, 166, 2, 0.3);
    }
    
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 166, 2, 0.4);
    }
    
    .footer {
      background: #f8f9fa;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    
    .footer-text {
      color: #666666;
      font-size: 14px;
      margin-bottom: 16px;
    }
    
    .social-links {
      margin: 20px 0;
    }
    
    .social-link {
      display: inline-block;
      width: 36px;
      height: 36px;
      background: #FFA602;
      color: #ffffff;
      border-radius: 50%;
      text-align: center;
      line-height: 36px;
      margin: 0 8px;
      text-decoration: none;
      font-weight: 600;
    }
    
    .warning-box {
      background: #fff3cd;
      border-left: 4px solid #FFA602;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    
    .warning-text {
      color: #856404;
      font-size: 14px;
    }
    
    .divider {
      height: 1px;
      background: #e9ecef;
      margin: 30px 0;
    }
    
    @media only screen and (max-width: 600px) {
      .email-container {
        margin: 0;
        border-radius: 0;
      }
      
      .header, .content, .footer {
        padding: 20px;
      }
      
      .otp-code {
        font-size: 28px;
        letter-spacing: 6px;
      }
      
      .button {
        padding: 14px 28px;
        font-size: 14px;
      }
    }
  </style>
`;

/**
 * Password Reset OTP Email Template
 */
export const getPasswordResetTemplate = (userName, otp, expiryMinutes = 10) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - SELLO</title>
    ${getEmailStyles()}
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">SELLO</div>
        <div class="tagline">Your Trusted Car Marketplace</div>
      </div>
      
      <div class="content">
        <h1 class="title">Password Reset Request</h1>
        <p class="subtitle">
          Hi ${
            userName || "there"
          }, we received a request to reset your password for your SELLO account. 
          Use the verification code below to proceed.
        </p>
        
        <div class="otp-container">
          <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Your verification code is:</div>
          <div class="otp-code">${otp}</div>
          <div style="font-size: 14px; color: #666; margin-top: 10px;">This code expires in ${expiryMinutes} minutes</div>
        </div>
        
        <div class="warning-box">
          <div class="warning-text">
            <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. 
            Your account remains secure.
          </div>
        </div>
        
        <div class="divider"></div>
        
        <p style="font-size: 14px; color: #666;">
          For your security, this code can only be used once. If you need a new code, 
          you can request another password reset.
        </p>
      </div>
      
      <div class="footer">
        <div class="footer-text">
          © ${new Date().getFullYear()} SELLO. All rights reserved.
        </div>
        <div class="social-links">
          <a href="#" class="social-link">f</a>
          <a href="#" class="social-link">t</a>
          <a href="#" class="social-link">in</a>
          <a href="#" class="social-link">ig</a>
        </div>
        <div style="font-size: 12px; color: #999; margin-top: 20px;">
          This is an automated message. Please do not reply to this email.
        </div>
      </div>
    </div>
  </body>
  </html>
`;

/**
 * Welcome Email Template
 */
export const getWelcomeTemplate = (userName) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to SELLO</title>
    ${getEmailStyles()}
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">SELLO</div>
        <div class="tagline">Your Trusted Car Marketplace</div>
      </div>
      
      <div class="content">
        <h1 class="title">Welcome to SELLO! 🎉</h1>
        <p class="subtitle">
          Hi ${
            userName || "there"
          }, we're excited to have you join our community of car enthusiasts! 
          Your account has been successfully created and you're ready to start your journey.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${
            process.env.CLIENT_URL || "https://sello.com"
          }" class="button">
            Start Exploring
          </a>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin: 30px 0;">
          <h3 style="color: #FFA602; margin-bottom: 16px;">What's Next?</h3>
          <ul style="color: #666; line-height: 1.8;">
            <li>🚗 Browse thousands of quality vehicles</li>
            <li>📝 Create your first listing</li>
            <li>🔍 Use advanced search filters</li>
            <li>💬 Connect with sellers directly</li>
            <li>📱 Get instant notifications</li>
          </ul>
        </div>
        
        <div class="divider"></div>
        
        <p style="font-size: 14px; color: #666;">
          Need help? Our support team is here to assist you at any time.
        </p>
      </div>
      
      <div class="footer">
        <div class="footer-text">
          © ${new Date().getFullYear()} SELLO. All rights reserved.
        </div>
        <div class="social-links">
          <a href="#" class="social-link">f</a>
          <a href="#" class="social-link">t</a>
          <a href="#" class="social-link">in</a>
          <a href="#" class="social-link">ig</a>
        </div>
        <div style="font-size: 12px; color: #999; margin-top: 20px;">
          This is an automated message. Please do not reply to this email.
        </div>
      </div>
    </div>
  </body>
  </html>
`;

/**
 * Account Verification Email Template
 */
export const getEmailVerificationTemplate = (userName, verificationLink) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - SELLO</title>
    ${getEmailStyles()}
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">SELLO</div>
        <div class="tagline">Your Trusted Car Marketplace</div>
      </div>
      
      <div class="content">
        <h1 class="title">Verify Your Email Address</h1>
        <p class="subtitle">
          Hi ${
            userName || "there"
          }, please confirm your email address to activate your SELLO account 
          and unlock all features.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" class="button">
            Verify Email Address
          </a>
        </div>
        
        <div class="warning-box">
          <div class="warning-text">
            <strong>Important:</strong> This verification link will expire in 24 hours. 
            After that, you'll need to request a new verification email.
          </div>
        </div>
        
        <div class="divider"></div>
        
        <p style="font-size: 14px; color: #666;">
          If you didn't create an account with SELLO, you can safely ignore this email.
        </p>
      </div>
      
      <div class="footer">
        <div class="footer-text">
          © ${new Date().getFullYear()} SELLO. All rights reserved.
        </div>
        <div class="social-links">
          <a href="#" class="social-link">f</a>
          <a href="#" class="social-link">t</a>
          <a href="#" class="social-link">in</a>
          <a href="#" class="social-link">ig</a>
        </div>
        <div style="font-size: 12px; color: #999; margin-top: 20px;">
          This is an automated message. Please do not reply to this email.
        </div>
      </div>
    </div>
  </body>
  </html>
`;

/**
 * Car Listing Approved Template
 */
export const getCarApprovedTemplate = (userName, carTitle, carId) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Listing is Live! - SELLO</title>
    ${getEmailStyles()}
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">SELLO</div>
        <div class="tagline">Your Trusted Car Marketplace</div>
      </div>
      
      <div class="content">
        <h1 class="title">🎉 Your Listing is Now Live!</h1>
        <p class="subtitle">
          Great news ${
            userName || "there"
          }! Your car listing "<strong>${carTitle}</strong>" 
          has been approved and is now visible to thousands of potential buyers.
        </p>
        
        <div style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-radius: 8px; padding: 24px; margin: 30px 0; border: 1px solid #28a745;">
          <h3 style="color: #155724; margin-bottom: 16px;">✅ Listing Status: Active</h3>
          <p style="color: #155724; margin-bottom: 16px;">
            Your listing is now active and receiving views from interested buyers.
          </p>
          <div style="text-align: center;">
            <a href="${
              process.env.CLIENT_URL || "https://sello.com"
            }/cars/${carId}" class="button" style="background: linear-gradient(135deg, #28a745 0%, #34ce57 100%);">
              View Your Listing
            </a>
          </div>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin: 30px 0;">
          <h3 style="color: #FFA602; margin-bottom: 16px;">💡 Pro Tips</h3>
          <ul style="color: #666; line-height: 1.8;">
            <li>📱 Respond quickly to buyer inquiries</li>
            <li>📸 Add more photos to increase visibility</li>
            <li>💎 Consider highlighting your listing</li>
            <li>📊 Track your listing performance</li>
          </ul>
        </div>
        
        <div class="divider"></div>
        
        <p style="font-size: 14px; color: #666;">
          Questions about your listing? Our support team is here to help!
        </p>
      </div>
      
      <div class="footer">
        <div class="footer-text">
          © ${new Date().getFullYear()} SELLO. All rights reserved.
        </div>
        <div class="social-links">
          <a href="#" class="social-link">f</a>
          <a href="#" class="social-link">t</a>
          <a href="#" class="social-link">in</a>
          <a href="#" class="social-link">ig</a>
        </div>
        <div style="font-size: 12px; color: #999; margin-top: 20px;">
          This is an automated message. Please do not reply to this email.
        </div>
      </div>
    </div>
  </body>
  </html>
`;

/**
 * Car Listing Rejected Template
 */
export const getCarRejectedTemplate = (userName, carTitle, rejectionReason) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Listing Update - SELLO</title>
    ${getEmailStyles()}
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">SELLO</div>
        <div class="tagline">Your Trusted Car Marketplace</div>
      </div>
      
      <div class="content">
        <h1 class="title">Listing Update</h1>
        <p class="subtitle">
          Hi ${
            userName || "there"
          }, we've reviewed your car listing "<strong>${carTitle}</strong>" 
          and have some feedback for you.
        </p>
        
        <div style="background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%); border-radius: 8px; padding: 24px; margin: 30px 0; border: 1px solid #dc3545;">
          <h3 style="color: #721c24; margin-bottom: 16px;">❌ Listing Status: Needs Revision</h3>
          <p style="color: #721c24; margin-bottom: 16px;">
            Your listing requires some changes before it can be approved.
          </p>
          ${
            rejectionReason
              ? `
            <div style="background: rgba(255,255,255,0.5); border-radius: 4px; padding: 16px; margin-top: 16px;">
              <strong>Reason:</strong> ${rejectionReason}
            </div>
          `
              : ""
          }
          <div style="text-align: center; margin-top: 20px;">
            <a href="${
              process.env.CLIENT_URL || "https://sello.com"
            }/edit-car" class="button" style="background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);">
              Update Your Listing
            </a>
          </div>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin: 30px 0;">
          <h3 style="color: #FFA602; margin-bottom: 16px;">💡 Common Issues & Solutions</h3>
          <ul style="color: #666; line-height: 1.8;">
            <li>📸 Add more high-quality photos</li>
            <li>📝 Provide detailed description</li>
            <li>💰 Set competitive pricing</li>
            <li>📞 Include contact information</li>
            <li>📋 Ensure all required fields are complete</li>
          </ul>
        </div>
        
        <div class="divider"></div>
        
        <p style="font-size: 14px; color: #666;">
          Need help? Our support team is here to assist you with getting your listing approved.
        </p>
      </div>
      
      <div class="footer">
        <div class="footer-text">
          © ${new Date().getFullYear()} SELLO. All rights reserved.
        </div>
        <div class="social-links">
          <a href="#" class="social-link">f</a>
          <a href="#" class="social-link">t</a>
          <a href="#" class="social-link">in</a>
          <a href="#" class="social-link">ig</a>
        </div>
        <div style="font-size: 12px; color: #999; margin-top: 20px;">
          This is an automated message. Please do not reply to this email.
        </div>
      </div>
    </div>
  </body>
  </html>
`;
