# How to Fix "SMTP Authentication Failed"

If you are seeing an error like `Invalid Password. Use an App Password` or `535 Authentication Failed`, it means Google is rejecting your password because it's not secure to use your main login password for sending emails via code.

You **MUST** generate a specific "App Password".

## Step-by-Step Instructions

1.  **Go to Google Account Security**
    *   Visit: [https://myaccount.google.com/security](https://myaccount.google.com/security)

2.  **Enable 2-Step Verification**
    *   Under "How you sign in to Google", look for "2-Step Verification".
    *   If it is OFF, click it and follow the steps to turn it **ON** (you'll need to verify with your phone).
    *   *Note: App Passwords request 2-Step Verification to be enabled.*

3.  **Generate App Password**
    *   After enabling 2-Step, go back to the Security page or search "App Passwords" in the top search bar.
    *   Or visit directly: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
    *   **App name**: Enter "Sello" (or any name).
    *   Click **Create**.

4.  **Copy the Password**
    *   Google will show you a 16-character code (e.g., `abcd efgh ijkl mnop`).
    *   Copy this code (spaces don't matter).

5.  **Update Your `.env` File**
    *   Open `server/.env`.
    *   Find `SMTP_PASSWORD`.
    *   Replace your current password with the 16-character code.
    
    ```env
    SMTP_PASSWORD=abcd efgh ijkl mnop
    ```

6.  **Restart Server**
    *   Stop your backend server (Ctrl+C).
    *   Start it again (`npm start` or `npm run dev`).

Now the Forgot Password email should work!
