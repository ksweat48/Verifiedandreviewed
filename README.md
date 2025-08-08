Verifiedandreviewed

## Deployment Instructions

### Setting up Supabase Environment Variables in Netlify

For the site to work properly in production, you need to add your Supabase credentials to Netlify:

1. Go to your Netlify dashboard
2. Navigate to Site settings → Environment variables
3. Add the following environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (required for server-side functions)
4. Redeploy your site

You can find these values in your Supabase project dashboard under Project Settings → API. The service role key is needed for Netlify Functions to bypass Row Level Security when logging activities.

### Local Development

For local development with Netlify Functions, use:
```bash
netlify dev
```

This ensures Netlify Functions are properly served locally. Do not use `npm run dev` if you need the activity logging functionality to work.

### Other Environment Variables

If you're using other services like WordPress, OpenAI, Google Business Profile, or Google Cloud Vision, you'll need to add those environment variables as well. See `.env.example` for a complete list.

### Google Cloud Vision Setup (Optional)

For AI-powered image moderation using Google Cloud Vision SafeSearch:

1. **Enable the API:** Go to Google Cloud Console → APIs & Services → Library → Search for "Cloud Vision API" → Enable
2. **Create Service Account:** IAM & Admin → Service Accounts → Create → Grant "Cloud Vision API User" role
3. **Download JSON Key:** Create and download a JSON key for the service account
4. **Add Environment Variables:** Extract values from the JSON and add to Netlify:
   - `GCP_PROJECT_ID`
   - `GCP_PRIVATE_KEY_ID` 
   - `GCP_PRIVATE_KEY` (include the full key with headers)
   - `GCP_CLIENT_EMAIL`
   - `GCP_CLIENT_ID`
5. **Enable in Admin:** Go to Admin Dashboard → Tools → Google Cloud Vision SafeSearch → Toggle ON

When disabled, images are moderated using basic checks only (file size, format, source validation).