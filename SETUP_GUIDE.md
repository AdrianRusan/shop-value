# ShopValue Setup Guide

This guide will help you set up ShopValue correctly and fix common authentication issues.

## 🔧 Environment Setup

### 1. Create Environment File

Create a `.env.local` file in your project root with the following variables:

```env
# Clerk Authentication (REQUIRED)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# MongoDB Database (REQUIRED)
MONGODB_URI=mongodb://localhost:27017/shopvalue

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Optional Services
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
```

### 2. Clerk Authentication Setup

1. **Create a Clerk Account**:
   - Go to [clerk.com](https://clerk.com)
   - Sign up for a free account
   - Create a new application

2. **Get Your Clerk Keys**:
   - In your Clerk dashboard, go to "API Keys"
   - Copy the "Publishable Key" to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Copy the "Secret Key" to `CLERK_SECRET_KEY`

3. **Configure Clerk Settings**:
   - Go to "User & Authentication" → "Email, Phone, Username"
   - Enable Email authentication
   - Set up your sign-in/sign-up flow preferences

4. **Set Up Webhooks** (Optional but recommended):
   - Go to "Webhooks" in Clerk dashboard
   - Add endpoint: `https://yourdomain.com/api/webhooks/clerk`
   - Enable events: `user.created`, `user.updated`, `user.deleted`, `session.created`
   - Copy the webhook secret to `CLERK_WEBHOOK_SECRET`

### 3. Database Setup

1. **MongoDB**:
   - Install MongoDB locally or use MongoDB Atlas
   - Update `MONGODB_URI` with your connection string
   - Example local: `mongodb://localhost:27017/shopvalue`
   - Example Atlas: `mongodb+srv://username:password@cluster.mongodb.net/shopvalue`

## 🐛 Troubleshooting Common Issues

### Issue: "Cannot sign up or login"

**Symptoms**: Sign-in/sign-up buttons don't work, authentication modals don't appear

**Solutions**:

1. **Check Environment Variables**:
   ```bash
   # Verify your .env.local file exists and contains Clerk keys
   cat .env.local | grep CLERK
   ```

2. **Restart Development Server**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

3. **Clear Browser Cache**:
   - Clear cookies and local storage for localhost:3000
   - Try in incognito/private mode

4. **Verify Clerk Configuration**:
   - Check Clerk dashboard for application status
   - Ensure domain localhost:3000 is added in Clerk settings

### Issue: "Dashboard is not accessible"

**Solutions**:
1. Ensure you're signed in first
2. Check middleware configuration in `middleware.ts`
3. Verify MongoDB connection

### Issue: "Products showing to non-authenticated users"

**Fixed**: We've updated the homepage to show sample products instead of real user data.

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Set up environment variables (see above)
cp .env.example .env.local  # Then edit with your values

# Start development server
npm run dev

# Visit application
open http://localhost:3000
```

## 📋 Pre-Launch Checklist

- [ ] Clerk keys configured in `.env.local`
- [ ] MongoDB connection working
- [ ] Sign-up flow working
- [ ] Sign-in flow working
- [ ] Dashboard accessible after login
- [ ] Products page working
- [ ] Search functionality working

## 🔒 Security Notes

- Never commit `.env.local` or `.env` files to version control
- Use different Clerk applications for development/staging/production
- Always use HTTPS in production
- Regularly rotate API keys

## 📧 Support

If you continue to experience issues:

1. Check the browser console for JavaScript errors
2. Check the terminal for server errors
3. Verify all environment variables are set correctly
4. Ensure MongoDB is running and accessible

## 🎯 Features Now Working

✅ **Fixed Homepage Design**: Improved responsive layout and visual hierarchy
✅ **Sample Products**: Non-authenticated users see demo products instead of real data
✅ **Enhanced Navigation**: Better authentication buttons and visual feedback
✅ **Proper Authentication Flow**: Clear sign-up and sign-in paths
✅ **Protected Dashboard**: Only accessible to authenticated users 