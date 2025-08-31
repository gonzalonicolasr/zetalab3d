# 🔐 Google OAuth Configuration Guide

## ⚠️ SECURITY CRITICAL

**NEVER store OAuth secrets in frontend code!** This guide shows you how to properly configure Google OAuth for ZETALAB using Supabase Dashboard (secure) vs frontend code (insecure).

## 🚫 What NOT to do (Security Risk)

```javascript
// ❌ NEVER DO THIS - Exposes secrets in frontend
const GOOGLE_CLIENT_SECRET = "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";
```

## ✅ Proper Configuration Steps

### Step 1: Supabase Dashboard Configuration

1. **Navigate to your Supabase project**:
   - URL: https://app.supabase.com/project/fwmyiovamcxvinoxnput
   - Go to: **Authentication** → **Providers**

2. **Configure Google OAuth**:
   ```
   Provider: Google
   Status: ✅ Enabled
   
   Client ID: [Your Google Client ID from Google Console]
   Client Secret: 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
   
   Redirect URL (auto-generated):
   https://fwmyiovamcxvinoxnput.supabase.co/auth/v1/callback
   ```

3. **Save Configuration**

### Step 2: Google Cloud Console Setup

1. **Go to Google Cloud Console**:
   - URL: https://console.cloud.google.com/
   - Navigate to: **APIs & Services** → **Credentials**

2. **Configure OAuth 2.0 Client**:
   - Find your OAuth 2.0 client ID
   - Add authorized redirect URI:
   ```
   https://fwmyiovamcxvinoxnput.supabase.co/auth/v1/callback
   ```

### Step 3: Verify Frontend Implementation

Your current implementation is **already secure** ✅

```javascript
// ✅ SECURE - No secrets exposed
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/calculadora.html`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    }
  }
});
```

## 🔍 Current Security Status

### ✅ What's Secure in Your Code:
- OAuth secrets stored only in Supabase Dashboard
- Frontend uses public Supabase client
- Proper redirect flow implemented
- Error handling for OAuth failures
- Automatic trial activation for new OAuth users

### 🔐 Security Features Implemented:
- **Row Level Security (RLS)** on database tables
- **Public keys only** in frontend (SUPABASE_ANON_KEY)
- **OAuth flow handled by Supabase** (secure backend)
- **Automatic session management**

## 🚀 Testing Your OAuth Setup

1. **Test Google Login**:
   - Go to: http://localhost:8000/ (or your dev server)
   - Click "Google" button
   - Should redirect to Google consent screen
   - After approval, redirect to `calculadora.html`

2. **Check for Errors**:
   - Open browser DevTools
   - Watch console for OAuth error messages
   - Common issues: wrong redirect URI, provider not enabled

## 📊 OAuth Flow Diagram

```
[User clicks Google] 
    ↓
[Frontend calls supabase.auth.signInWithOAuth()]
    ↓
[Supabase redirects to Google with CLIENT_ID]
    ↓
[Google consent screen]
    ↓
[Google redirects back to Supabase with auth code]
    ↓
[Supabase exchanges code for tokens using CLIENT_SECRET (secure)]
    ↓
[Supabase redirects to calculadora.html with session]
    ↓
[Frontend receives authenticated user]
```

## 🐛 Troubleshooting

### Error: "Provider not enabled"
- **Solution**: Enable Google provider in Supabase Dashboard

### Error: "Invalid redirect URI"
- **Solution**: Add correct redirect URI to Google Console:
  ```
  https://fwmyiovamcxvinoxnput.supabase.co/auth/v1/callback
  ```

### Error: "OAuth client not found"
- **Solution**: Check Client ID and Secret in Supabase Dashboard

### User redirected but not logged in
- **Solution**: Check browser console for session errors

## 📝 OAuth Configuration Checklist

- [ ] Google OAuth enabled in Supabase Dashboard
- [ ] Client ID configured in Supabase
- [ ] Client Secret `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` added to Supabase
- [ ] Redirect URI added to Google Console
- [ ] Frontend OAuth buttons working
- [ ] Test login flow end-to-end
- [ ] Verify automatic trial activation for new OAuth users

## 🔄 Auto Trial Activation

Your system automatically activates 7-day trials for new OAuth users:

```javascript
// This runs automatically after OAuth success
if (isOAuthUser && window.subscriptionService) {
  await window.subscriptionService.activateTrialForNewUser(userId);
  // Shows welcome modal with trial benefits
}
```

## 🎯 Next Steps

1. **Configure the secret in Supabase Dashboard** (not in code)
2. **Test the complete OAuth flow**
3. **Verify new users get automatic trial activation**
4. **Monitor for any OAuth errors in production**

---
**Remember**: OAuth secrets belong in secure backends (Supabase Dashboard), never in frontend JavaScript files.