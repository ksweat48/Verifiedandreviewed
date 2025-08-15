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

If you're using other services like WordPress, OpenAI, or Google Business Profile, you'll need to add those environment variables as well. See `.env.example` for a complete list.