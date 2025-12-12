# Google OAuth Setup Guide

This guide explains how to configure Google OAuth authentication for Grade Math.

## Prerequisites

- A Google account
- Access to Google Cloud Console
- Access to Supabase Dashboard

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" > "New Project"
3. Enter project name: "Grade Math" (or your preferred name)
4. Click "Create"

## Step 2: Configure OAuth Consent Screen

1. In Google Cloud Console, go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace account)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Grade Math
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. On Scopes page, click "Add or Remove Scopes"
7. Select these scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
8. Click "Save and Continue"
9. Add test users if in testing mode
10. Review and click "Back to Dashboard"

## Step 3: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application** as the application type
4. Enter a name: "Grade Math Web Client"
5. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://your-production-domain.com
   ```
6. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/callback
   https://your-production-domain.com/auth/callback
   https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
   ```
7. Click "Create"
8. Save the **Client ID** and **Client Secret**

## Step 4: Configure Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your Grade Math project
3. Navigate to **Authentication** > **Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Sign in with Google**
6. Enter:
   - **Client ID**: (from Step 3)
   - **Client Secret**: (from Step 3)
7. Click **Save**

## Step 5: Update Redirect URLs

Ensure your Supabase redirect URLs include:

1. Go to **Authentication** > **URL Configuration**
2. Add to **Redirect URLs**:
   ```
   http://localhost:3000/**
   https://your-production-domain.com/**
   ```

## Step 6: Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to `/login`
3. Click "Continue with Google"
4. Complete the Google sign-in flow
5. Verify you're redirected to the dashboard

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

The redirect URI in your request doesn't match any authorized URIs.

**Solution**:
1. Check the exact URL in the error message
2. Add it to **Authorized redirect URIs** in Google Cloud Console
3. Wait a few minutes for changes to propagate

### "Access blocked: Authorization Error"

The OAuth consent screen is in testing mode and your email isn't a test user.

**Solution**:
1. Add your email as a test user, OR
2. Publish the OAuth consent screen to production

### "Sign in with Google is not configured"

Supabase Google provider isn't enabled.

**Solution**:
1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Google and add credentials

### User created but profile not populated

The profile trigger may not be set up.

**Solution**: Ensure the `handle_new_user` trigger exists:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## Production Checklist

Before going live:

- [ ] OAuth consent screen is published (not in testing mode)
- [ ] Production domain added to authorized origins
- [ ] Production redirect URIs configured
- [ ] Supabase production URL added to Google Cloud Console
- [ ] Client ID and Secret are stored securely (not in code)
- [ ] Test sign-in flow on production domain

## Security Recommendations

1. **Never commit OAuth credentials** - Use environment variables
2. **Restrict authorized origins** - Only include domains you control
3. **Monitor usage** - Check Google Cloud Console for unusual activity
4. **Enable 2FA** on your Google Cloud account
5. **Rotate credentials** periodically

## Environment Variables

For production, ensure these are set:

```env
# These are configured in Supabase Dashboard, not in .env
# Google OAuth credentials are stored in Supabase, not locally

# Your Supabase project handles OAuth internally
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Support

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Grade Math Documentation](./README.md)
