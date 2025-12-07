#!/bin/bash
# Script to fix .env file CLIENT_URL issue

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env file..."
    touch "$ENV_FILE"
fi

# Check if CLIENT_URL exists and contains Google Meet
if grep -q "CLIENT_URL.*meet.google.com" "$ENV_FILE"; then
    echo "❌ Found Google Meet URL in CLIENT_URL - Fixing..."
    # Remove or comment out the line with Google Meet
    sed -i.bak '/CLIENT_URL.*meet\.google\.com/d' "$ENV_FILE"
    echo "✅ Removed Google Meet URL from CLIENT_URL"
fi

# Check if CLIENT_URL exists
if ! grep -q "^CLIENT_URL=" "$ENV_FILE"; then
    echo "Adding CLIENT_URL..."
    echo "" >> "$ENV_FILE"
    echo "# Frontend URL" >> "$ENV_FILE"
    echo "CLIENT_URL=http://localhost:5173" >> "$ENV_FILE"
    echo "✅ Added CLIENT_URL=http://localhost:5173"
else
    echo "CLIENT_URL already exists"
    grep "^CLIENT_URL=" "$ENV_FILE"
fi

echo ""
echo "✅ .env file fixed! Please restart your server."

