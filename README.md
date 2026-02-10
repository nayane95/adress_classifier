# Contact Classifier - AI-Powered Contact Classification System

A production-ready web application that classifies contacts from CSV files into **CLIENT**, **PRESCRIBER**, **SUPPLIER**, or **A_QUALIFIER** categories using cost-optimized AI and web enrichment.

## 🌟 Features

### Cost-Optimized AI Pipeline
- **Rules-First Approach**: Weighted keyword matching (FR+EN) classifies high-confidence contacts without AI
- **Tiered AI Models**: Uses cost-efficient models first, escalates only when needed
- **Smart Caching**: Enrichment and AI response caching reduces repeated API calls
- **Budget Caps**: Configurable limits on AI usage, search calls, and tokens per job
- **A_QUALIFIER Bias Prevention**: Strongly prefers definitive categories over "To Qualify"

### Web Enrichment (Compliant)
- Bing Search API integration for business context
- Google Maps Places API for category verification
- Website metadata extraction (robots.txt compliant)
- Staged enrichment depth (1-3) based on confidence needs
- Cache-first lookup with configurable TTL

### Real-Time UX
- Live progress tracking via Supabase Realtime (WebSockets)
- Activity feed showing AI usage, enrichment, and errors
- Stepper visualization of current processing phase
- No page refresh needed - all updates stream live

### Multi-Language Support
- Full English and French translations
- UI language switcher with cookie persistence
- AI prompts adapt to selected language
- Bilingual classification reasons and signals

### Manual Editing & Audit
- Inline editing of classifications
- Full audit trail (who, when, previous value)
- Manual override flag
- Needs review indicators

### Analytics & Demographics
- Category distribution charts
- Geographic breakdown (country, city)
- Confidence histograms
- AI vs Rules comparison
- Live updates on filter changes

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **TanStack Table v8** with virtualization
- **Recharts** for analytics
- **next-intl** for i18n

### Backend
- **Supabase** (Postgres + Storage + Realtime)
- **Supabase Edge Functions** (Deno runtime)
- **OpenAI API** (Structured Outputs)
- **Bing Search API** / Google Maps API

### Deployment
- **Vercel** (frontend)
- **Supabase** (backend + database)

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- OpenAI API key
- Bing Search API key (or alternative search API)
- Google Maps API key (optional but recommended)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd contact_cat_v2
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migrations in order:
   ```sql
   -- In Supabase SQL Editor, run these files in order:
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_functions.sql
   supabase/migrations/003_storage.sql
   ```
3. Deploy Edge Functions:
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Link to your project
   supabase link --project-ref your-project-ref
   
   # Deploy functions
   supabase functions deploy parse-csv
   supabase functions deploy classify-rules
   supabase functions deploy enrich-contacts
   supabase functions deploy classify-ai
   ```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

OPENAI_API_KEY=your_openai_key
BING_SEARCH_API_KEY=your_bing_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📊 CSV Format

The system expects **exactly 25 columns** in this order:

1. Avatar 128
2. Nom complet
3. N° TVA
4. Prochain avis
5. Activation
6. Partner Level
7. Envoi de la facture
8. format eInvoice
9. E-mail
10. Téléphone
11. Vendeur
12. Activités
13. Rue
14. Ville
15. État
16. Pays
17. Stats
18. Étiquettes
19. Responsable
20. Rappels
21. Statut de la relance
22. Prochain rappel
23. Niveau de relance
24. Montant dû
25. Total en retard

**Output columns appended** (26-35):
- Final Category
- Confidence Level (%)
- Public Signals Used
- Reason for Categorisation
- Needs Review
- Classification Method
- AI Used
- Enrichment Status
- Manual Override
- Last Processing Step

## ⚙️ Cost Optimization Configuration

Adjust these environment variables to control costs:

```env
# Rules engine thresholds
RULE_ACCEPT_THRESHOLD=80        # Min confidence to accept rules classification
RULE_MARGIN_THRESHOLD=15        # Min margin between top 2 categories

# AI thresholds
AI_ACCEPT_THRESHOLD=70          # Min confidence to accept AI classification

# Budget caps
MAX_AI_ROWS_PERCENT=60          # Max % of rows that can use AI
MAX_SEARCH_CALLS_PER_JOB=500    # Max web search calls per job
MAX_AI_TOKENS_PER_JOB=1000000   # Max OpenAI tokens per job

# Cache TTL
ENRICHMENT_CACHE_TTL_DAYS=30    # How long to cache enrichment data
AI_CACHE_TTL_DAYS=90            # How long to cache AI responses

# Models
OPENAI_MODEL_PRIMARY=gpt-4o-mini      # Cost-efficient model
OPENAI_MODEL_SECONDARY=gpt-4o         # Stronger model for escalation
```

## 🔄 Classification Pipeline

1. **Parse CSV**: Validate schema, normalize data
2. **Rules Classification**: Weighted keyword matching (FR+EN)
3. **Enrichment** (on-demand): Web search, Maps API, website metadata
4. **AI Classification**: OpenAI with structured outputs, tiered models
5. **Deep Enrichment + Retry**: For low-confidence results
6. **Export**: Generate CSV with all 35 columns

Each step:
- Persists state to database
- Emits real-time updates
- Logs to activity feed

## 📱 Usage

1. **Upload CSV**: Drag and drop your CSV file
2. **Monitor Progress**: Watch real-time classification progress
3. **Review Results**: View data table with filters and sorting
4. **Edit Classifications**: Inline edit any misclassifications
5. **Analyze**: View analytics and demographics
6. **Export**: Download results with all columns

## 🚢 Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Supabase Production Setup

1. Upgrade to Supabase Pro if needed (for higher limits)
2. Enable Realtime for `jobs` and `activity_feed` tables
3. Configure storage buckets with appropriate policies
4. Deploy Edge Functions to production
5. Set Edge Function secrets:
   ```bash
   supabase secrets set OPENAI_API_KEY=your_key
   supabase secrets set BING_SEARCH_API_KEY=your_key
   supabase secrets set GOOGLE_MAPS_API_KEY=your_key
   ```

## 🔒 Security Notes

- Row Level Security (RLS) is enabled on all tables
- Storage buckets require authentication
- Edge Functions validate input
- No direct LinkedIn scraping (compliant enrichment only)
- Respects robots.txt for website metadata

## 📈 Monitoring

- Check Supabase logs for Edge Function errors
- Monitor OpenAI usage in OpenAI dashboard
- Track search API usage in respective dashboards
- Review activity feed for job-level insights

## 🐛 Troubleshooting

### CSV Upload Fails
- Verify CSV has exactly 25 columns
- Check column names match expected schema
- Ensure file is valid UTF-8 encoded

### AI Classification Not Working
- Verify OpenAI API key is set
- Check API key has sufficient credits
- Review Edge Function logs for errors

### Enrichment Fails
- Verify search API keys are set
- Check API quotas/limits
- Review budget caps in environment variables

### Real-time Updates Not Working
- Ensure Realtime is enabled in Supabase
- Check WebSocket connection in browser console
- Verify RLS policies allow reads

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📧 Support

For issues or questions, please open a GitHub issue.

---

Built with ❤️ using Next.js, Supabase, and OpenAI
