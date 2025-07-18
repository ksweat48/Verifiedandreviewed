Verifiedandreviewed

## Deployment Instructions

### Setting up Supabase Environment Variables in Netlify

For the site to work properly in production, you need to add your Supabase credentials to Netlify:

1. Go to your Netlify dashboard
2. Navigate to Site settings → Environment variables
3. Add the following environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
4. Redeploy your site

You can find these values in your Supabase project dashboard under Project Settings → API.

### Other Environment Variables

If you're using other services like WordPress, OpenAI, or Google Business Profile, you'll need to add those environment variables as well. See `.env.example` for a complete list.