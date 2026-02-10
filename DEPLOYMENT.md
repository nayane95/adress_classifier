# Deployment Guide - Contact Classifier

Complete step-by-step deployment instructions for production.

## Prerequisites Checklist

- [ ] Supabase account (Pro tier recommended for production)
- [ ] Vercel account
- [ ] OpenAI API key with credits
- [ ] Bing Search API key (or alternative)
- [ ] Google Maps API key (optional)
- [ ] Domain name (optional)

## Part 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose organization and region (closest to your users)
4. Set database password (save this securely!)
5. Wait for project to be provisioned (~2 minutes)

### 1.2 Run Database Migrations

1. Go to SQL Editor in Supabase dashboard
2. Create a new query
3. Copy and paste content from `supabase/migrations/001_initial_schema.sql`
4. Click "Run"
5. Repeat for `002_functions.sql` and `003_storage.sql`

Verify:
- Tables created: `jobs`, `job_rows`, `enrichment_cache`, `ai_cache`, `activity_feed`
- Storage buckets created: `csv-uploads`, `csv-exports`

### 1.3 Enable Realtime

1. Go to Database → Replication
2. Enable replication for:
   - `jobs` table
   - `activity_feed` table
3. Click "Save"

### 1.4 Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all functions
supabase functions deploy parse-csv
supabase functions deploy classify-rules
supabase functions deploy enrich-contacts
supabase functions deploy classify-ai

# Set secrets for Edge Functions
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set BING_SEARCH_API_KEY=...
supabase secrets set GOOGLE_MAPS_API_KEY=...
supabase secrets set RULE_ACCEPT_THRESHOLD=80
supabase secrets set RULE_MARGIN_THRESHOLD=15
supabase secrets set AI_ACCEPT_THRESHOLD=70
supabase secrets set MAX_AI_ROWS_PERCENT=60
supabase secrets set MAX_SEARCH_CALLS_PER_JOB=500
supabase secrets set MAX_AI_TOKENS_PER_JOB=1000000
supabase secrets set ENRICHMENT_CACHE_TTL_DAYS=30
supabase secrets set AI_CACHE_TTL_DAYS=90
supabase secrets set OPENAI_MODEL_PRIMARY=gpt-4o-mini
supabase secrets set OPENAI_MODEL_SECONDARY=gpt-4o
supabase secrets set OPENAI_MODEL_SECONDARY=gpt-4o
```

**Note:** The `classify-ai` function now includes enhanced logging for AI requests and responses. Redeploying is required to see these logs in the UI.

### 1.5 Get Supabase Credentials

1. Go to Project Settings → API
2. Copy:
   - Project URL (NEXT_PUBLIC_SUPABASE_URL)
   - anon/public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - service_role key (SUPABASE_SERVICE_ROLE_KEY) - **Keep this secret!**

## Part 2: Vercel Deployment

### 2.1 Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/contact-classifier.git
git branch -M main
git push -u origin main
```

### 2.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 2.3 Set Environment Variables

In Vercel project settings → Environment Variables, add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (encrypted)

OPENAI_API_KEY=sk-... (encrypted)
OPENAI_MODEL_PRIMARY=gpt-4o-mini
OPENAI_MODEL_SECONDARY=gpt-4o

BING_SEARCH_API_KEY=... (encrypted)
GOOGLE_MAPS_API_KEY=... (encrypted)

RULE_ACCEPT_THRESHOLD=80
RULE_MARGIN_THRESHOLD=15
AI_ACCEPT_THRESHOLD=70
MAX_AI_ROWS_PERCENT=60
MAX_SEARCH_CALLS_PER_JOB=500
MAX_AI_TOKENS_PER_JOB=1000000
ENRICHMENT_CACHE_TTL_DAYS=30
AI_CACHE_TTL_DAYS=90

NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

**Important**: Mark sensitive keys as "Encrypted" in Vercel!

### 2.4 Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Visit your deployment URL

## Part 3: Custom Domain (Optional)

### 3.1 Add Domain to Vercel

1. Go to Project Settings → Domains
2. Add your domain (e.g., `classifier.yourdomain.com`)
3. Follow DNS configuration instructions

### 3.2 Update Environment Variables

Update `NEXT_PUBLIC_APP_URL` to your custom domain.

## Part 4: Testing

### 4.1 Smoke Tests

1. Visit your deployed URL
2. Switch language (EN ↔ FR)
3. Upload a small test CSV (5-10 rows)
4. Verify:
   - Upload succeeds
   - Job is created
   - Real-time updates work
   - Classifications appear
   - Export works

### 4.2 Monitor Logs

- **Vercel**: Runtime logs in Vercel dashboard
- **Supabase**: Edge Function logs in Supabase dashboard
- **OpenAI**: Usage in OpenAI dashboard

## Part 5: Production Optimizations

### 5.1 Supabase

- Upgrade to Pro tier for:
  - Higher database limits
  - More Edge Function invocations
  - Better support
- Enable Point-in-Time Recovery (PITR) for backups
- Set up database backups schedule

### 5.2 Vercel

- Enable Analytics
- Set up monitoring/alerts
- Configure caching headers if needed

### 5.3 Cost Management

- Set OpenAI usage limits in OpenAI dashboard
- Monitor Bing/Google API usage
- Adjust budget caps in environment variables
- Review Supabase usage regularly

## Part 6: Maintenance

### 6.1 Database Cleanup

Run periodically to clean expired cache:

```sql
DELETE FROM enrichment_cache WHERE expires_at < NOW();
DELETE FROM ai_cache WHERE expires_at < NOW();
```

Or set up a cron job (requires pg_cron extension).

### 6.2 Updates

To deploy updates:

```bash
git add .
git commit -m "Update description"
git push origin main
```

Vercel will auto-deploy on push to main.

### 6.3 Monitoring

- Check error rates in Vercel
- Review Edge Function logs weekly
- Monitor API costs monthly
- Check database size growth

## Troubleshooting

### Edge Functions Not Working

```bash
# Check function logs
supabase functions logs parse-csv --tail

# Redeploy specific function
supabase functions deploy parse-csv --no-verify-jwt
```

### Database Connection Issues

- Check RLS policies are correct
- Verify anon key has proper permissions
- Review Supabase logs for auth errors

### High Costs

- Review AI usage percentage (should be < 60%)
- Check cache hit rates
- Verify budget caps are enforced
- Consider adjusting thresholds

## Security Checklist

- [ ] Service role key is encrypted in Vercel
- [ ] RLS policies are enabled on all tables
- [ ] Storage buckets require authentication
- [ ] API keys are not exposed in client code
- [ ] CORS is properly configured
- [ ] Rate limiting is in place (Vercel/Supabase)

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check Supabase Edge Function logs
3. Review browser console for client errors
4. Open a GitHub issue with error details

---

**Deployment Complete!** 🎉

Your Contact Classifier is now live and ready to use.
