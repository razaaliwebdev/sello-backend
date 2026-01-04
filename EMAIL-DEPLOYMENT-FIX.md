# Email Deployment Fix Guide

## 🔍 Common Issues: Emails Work Locally but Fail in Production

### **Issue 1: Missing Environment Variables**
Most deployments miss SMTP configuration. Check these in your deployment panel:

```bash
# REQUIRED Environment Variables
SMTP_HOST=mail.yourdomain.com        # Your SMTP server
SMTP_PORT=587                         # 587 for TLS, 465 for SSL
SMTP_MAIL=noreply@yourdomain.com      # Your email address
SMTP_PASSWORD=your-email-password     # Email account password
SMTP_USERNAME=noreply@yourdomain.com  # Usually same as SMTP_MAIL

# OPTIONAL
ENABLE_EMAIL_NOTIFICATIONS=true       # Enable/disable emails
```

### **Issue 2: Wrong SMTP Settings for Production**

#### **For cPanel/Shared Hosting:**
1. Login to cPanel
2. Go to **Email Accounts** → **Connect Devices** next to your email
3. Copy **Outgoing (SMTP)** settings:
   - Server: `mail.yourdomain.com`
   - Port: `587` (TLS) or `465` (SSL)
   - Username: Full email address
   - Password: Email account password

#### **For Gmail (if still using Gmail):**
1. Enable 2-factor authentication
2. Generate **App Password** (not regular password)
3. Use these settings:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_MAIL=your-email@gmail.com
   SMTP_PASSWORD=your-16-digit-app-password
   ```

### **Issue 3: Firewall/Port Blocking**

#### **Test SMTP Connection:**
```bash
# Test port 587
telnet mail.yourdomain.com 587

# Test port 465
telnet mail.yourdomain.com 465
```

If connection fails, contact your hosting provider to unblock SMTP ports.

## 🛠️ Debug Steps

### **Step 1: Check Environment Variables**
```bash
# On your production server
curl http://your-domain.com/api/auth/debug-email
```

This will show which environment variables are missing.

### **Step 2: Test Email Send**
```bash
# Run debug script
node debug-email.js
```

### **Step 3: Check Server Logs**
Look for these error patterns:
- `SMTP Configuration missing`
- `SMTP Connection Failed`
- `SMTP Authentication Failed`

## 🔧 Quick Fixes

### **Fix 1: Add Missing Environment Variables**
In your deployment platform (Render, Heroku, etc.):

```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_MAIL=noreply@yourdomain.com
SMTP_PASSWORD=your-email-password
SMTP_USERNAME=noreply@yourdomain.com
ENABLE_EMAIL_NOTIFICATIONS=true
```

### **Fix 2: Use Production Email Service**
If local email doesn't work in production, consider:
- **SendGrid** (recommended for production)
- **Mailgun**
- **AWS SES**

#### **SendGrid Setup:**
```bash
# Install SendGrid
npm install @sendgrid/mail

# Environment Variables
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
```

### **Fix 3: Fallback to Development Mode**
For testing, you can disable emails in production:
```bash
ENABLE_EMAIL_NOTIFICATIONS=false
```

## 📊 Common Error Messages & Solutions

### **"SMTP Configuration missing"**
**Solution**: Add missing SMTP environment variables

### **"SMTP Connection Failed"**
**Solution**: Check SMTP_HOST and SMTP_PORT, test connectivity

### **"SMTP Authentication Failed"**
**Solution**: Verify email credentials, use app password for Gmail

### **"Email disabled in development"**
**Solution**: Set `ENABLE_EMAIL_NOTIFICATIONS=true`

## 🎯 Production Checklist

Before deploying:

- [ ] All SMTP environment variables set
- [ ] Email account exists and works
- [ ] SMTP ports (587/465) are open
- [ ] Test email send works
- [ ] Remove debug endpoints from production

## 🚀 Alternative Solutions

If SMTP continues to fail:

### **Option 1: Use Third-Party Email Service**
```javascript
// SendGrid example
import sendGridMail from '@sendgrid/mail';
sendGridMail.setApiKey(process.env.SENDGRID_API_KEY);
```

### **Option 2: Use Email Queue**
```javascript
// Add emails to queue for background processing
// Better for production reliability
```

### **Option 3: Disable Emails Temporarily**
```javascript
// For testing without emails
process.env.ENABLE_EMAIL_NOTIFICATIONS = 'false';
```

## 📞 Support

If issues persist:
1. Check server logs for detailed error messages
2. Test SMTP connection manually
3. Contact hosting provider for SMTP configuration
4. Consider switching to dedicated email service
